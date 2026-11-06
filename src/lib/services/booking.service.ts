import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BookingStatus, NotificationStatus, NotificationType } from "@prisma/client";
import { CreateBookingInput } from "@/lib/validations/booking.schema";
import { getHostAndEventType, getEffectiveWindows } from "@/lib/services/availability.service";
import { hashPayload } from "@/lib/utils/time";
import { buildNotificationPayload } from "@/lib/notifications/notification.service";
import {
  SlotUnavailableError,
  SlotConflictError,
  IdempotencyConflictError,
  ValidationError,
  NotFoundError,
} from "@/lib/errors";

export interface BookingResponse {
  id: string;
  hostId: string;
  eventTypeId: string;
  guestName: string;
  guestEmail: string;
  startAt: string;
  endAt: string;
  reservedStartAt: string;
  reservedEndAt: string;
  status: BookingStatus;
  cancellationKey: string;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  host: {
    id: string;
    name: string;
    email: string;
    slug: string;
    timezone: string;
  };
  eventType: {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    duration: number;
    bufferBefore: number;
    bufferAfter: number;
    location?: string | null;
  };
}

/**
 * Creates a booking transactionally with host-level row locking and buffer-aware concurrency protection.
 * Supports API idempotency using the IdempotencyKey store.
 */
export async function createBooking(
  input: CreateBookingInput,
  idempotencyKey?: string | null,
  overrideNowUtc?: DateTime
): Promise<{ booking: BookingResponse; isIdempotentReplay: boolean }> {
  const now = overrideNowUtc ?? DateTime.utc();

  // 1. Idempotency Check
  let requestHash: string | undefined;
  if (idempotencyKey) {
    requestHash = hashPayload(input);

    const existingKey = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existingKey) {
      const isExpired = DateTime.fromJSDate(existingKey.expiresAt) < now;
      if (!isExpired) {
        if (existingKey.requestHash === requestHash && existingKey.responseBody) {
          // Same key + same payload => return cached response
          return {
            booking: JSON.parse(existingKey.responseBody) as BookingResponse,
            isIdempotentReplay: true,
          };
        } else {
          // Same key + different payload => conflict
          throw new IdempotencyConflictError(
            `Idempotency-Key '${idempotencyKey}' was previously used with different request parameters.`
          );
        }
      }
    }
  }

  // 2. Load and validate Host and EventType
  const { host, eventType } = await getHostAndEventType(input.hostId, input.eventTypeId);

  // 3. Server-side instant and buffer calculations (never trust client-computed ends)
  const startAtUtc = DateTime.fromISO(input.startAt, { zone: "utc" });
  if (!startAtUtc.isValid) {
    throw new ValidationError(`Invalid startAt ISO timestamp: ${input.startAt}`);
  }

  if (startAtUtc <= now) {
    throw new SlotUnavailableError("Cannot book time slots in the past.");
  }

  const endAtUtc = startAtUtc.plus({ minutes: eventType.duration });
  const reservedStartAtUtc = startAtUtc.minus({ minutes: eventType.bufferBefore });
  const reservedEndAtUtc = endAtUtc.plus({ minutes: eventType.bufferAfter });

  // 4. Transactional Concurrency Execution
  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        // A. Host-level row lock (SELECT ... FOR UPDATE) to serialize booking transactions per host
        await tx.$queryRaw`SELECT "id" FROM "Host" WHERE "id" = ${host.id} FOR UPDATE`;

        // B. Re-validate schedule window in host timezone
        const startInHostZone = startAtUtc.setZone(host.timezone);
        const dateIso = startInHostZone.toFormat("yyyy-MM-dd");

        const windows = await getEffectiveWindows(host.id, host.timezone, dateIso);
        const fitsInWindow = windows.some(
          (w) =>
            startInHostZone >= w.windowStart &&
            startInHostZone.plus({ minutes: eventType.duration }) <= w.windowEnd
        );

        if (!fitsInWindow) {
          throw new SlotUnavailableError(
            "Requested time slot is outside the host's operating schedule or on an unavailable date."
          );
        }

        // C. Re-validate availability inside the transaction against existing active bookings
        const conflictingBooking = await tx.booking.findFirst({
          where: {
            hostId: host.id,
            status: { not: BookingStatus.CANCELLED },
            reservedStartAt: { lt: reservedEndAtUtc.toJSDate() },
            reservedEndAt: { gt: reservedStartAtUtc.toJSDate() },
          },
        });

        if (conflictingBooking) {
          throw new SlotConflictError(
            "The requested time slot is already booked or overlaps with an existing reservation."
          );
        }

        // D. Create the booking record
        const createdBooking = await tx.booking.create({
          data: {
            hostId: host.id,
            eventTypeId: eventType.id,
            guestName: input.guestName,
            guestEmail: input.guestEmail,
            startAt: startAtUtc.toJSDate(),
            endAt: endAtUtc.toJSDate(),
            reservedStartAt: reservedStartAtUtc.toJSDate(),
            reservedEndAt: reservedEndAtUtc.toJSDate(),
            status: BookingStatus.CONFIRMED,
          },
          include: {
            host: { select: { id: true, name: true, email: true, slug: true, timezone: true } },
            eventType: {
              select: {
                id: true,
                title: true,
                slug: true,
                description: true,
                duration: true,
                bufferBefore: true,
                bufferAfter: true,
                location: true,
              },
            },
          },
        });

        // E. Create notification records transactionally (Phase 5: Background Worker Architecture)
        const reminderLeadHours = parseInt(process.env.REMINDER_LEAD_HOURS || "24", 10);
        const reminderTarget = startAtUtc.minus({ hours: reminderLeadHours });

        const payload = buildNotificationPayload({
          bookingId: createdBooking.id,
          guestName: createdBooking.guestName,
          guestEmail: createdBooking.guestEmail,
          hostName: createdBooking.host.name,
          hostEmail: createdBooking.host.email,
          hostSlug: createdBooking.host.slug,
          hostTimezone: createdBooking.host.timezone,
          eventTitle: createdBooking.eventType.title,
          eventSlug: createdBooking.eventType.slug,
          duration: createdBooking.eventType.duration,
          location: createdBooking.eventType.location,
          startAt: createdBooking.startAt,
          endAt: createdBooking.endAt,
        });

        // 1. Booking Confirmation notification (Status: PENDING, scheduled immediately)
        await tx.notification.create({
          data: {
            bookingId: createdBooking.id,
            type: NotificationType.CONFIRMATION,
            status: NotificationStatus.PENDING,
            recipientEmail: createdBooking.guestEmail,
            recipientType: "GUEST",
            subject: `Confirmed: ${createdBooking.eventType.title} with ${createdBooking.host.name}`,
            payload: payload as object,
            scheduledAt: now.toJSDate(),
          },
        });

        // 2. Booking Reminder notification (Scheduled only if appointment is far enough in the future)
        if (reminderTarget > now) {
          await tx.notification.create({
            data: {
              bookingId: createdBooking.id,
              type: NotificationType.REMINDER,
              status: NotificationStatus.SCHEDULED,
              recipientEmail: createdBooking.guestEmail,
              recipientType: "GUEST",
              subject: `Reminder: ${createdBooking.eventType.title} with ${createdBooking.host.name} is coming up`,
              payload: payload as object,
              scheduledAt: reminderTarget.toJSDate(),
            },
          });
        }

        const formattedResponse: BookingResponse = {
          id: createdBooking.id,
          hostId: createdBooking.hostId,
          eventTypeId: createdBooking.eventTypeId,
          guestName: createdBooking.guestName,
          guestEmail: createdBooking.guestEmail,
          startAt: DateTime.fromJSDate(createdBooking.startAt, { zone: "utc" }).toISO()!,
          endAt: DateTime.fromJSDate(createdBooking.endAt, { zone: "utc" }).toISO()!,
          reservedStartAt: DateTime.fromJSDate(createdBooking.reservedStartAt, { zone: "utc" }).toISO()!,
          reservedEndAt: DateTime.fromJSDate(createdBooking.reservedEndAt, { zone: "utc" }).toISO()!,
          status: createdBooking.status,
          cancellationKey: createdBooking.cancellationKey,
          cancellationReason: createdBooking.cancellationReason,
          createdAt: DateTime.fromJSDate(createdBooking.createdAt, { zone: "utc" }).toISO()!,
          updatedAt: DateTime.fromJSDate(createdBooking.updatedAt, { zone: "utc" }).toISO()!,
          host: createdBooking.host,
          eventType: createdBooking.eventType,
        };

        // F. Store IdempotencyKey record if requested
        if (idempotencyKey && requestHash) {
          const expiresAt = now.plus({ hours: 24 }).toJSDate();
          await tx.idempotencyKey.upsert({
            where: { key: idempotencyKey },
            update: {
              bookingId: createdBooking.id,
              requestHash,
              responseBody: JSON.stringify(formattedResponse),
              statusCode: 201,
              expiresAt,
            },
            create: {
              key: idempotencyKey,
              bookingId: createdBooking.id,
              requestHash,
              responseBody: JSON.stringify(formattedResponse),
              statusCode: 201,
              expiresAt,
            },
          });
        }

        return formattedResponse;
      },
      {
        isolationLevel: "ReadCommitted",
      }
    );

    return { booking, isIdempotentReplay: false };
  } catch (error: unknown) {
    // Catch PostgreSQL GiST exclusion constraint violation (error code 23P01)
    if (
      typeof error === "object" &&
      error !== null &&
      (("code" in error && (error as { code: string }).code === "23P01") ||
        ("message" in error &&
          typeof (error as { message: string }).message === "string" &&
          (error as { message: string }).message.includes("no_overlapping_reserved_bookings")))
    ) {
      throw new SlotConflictError(
        "The requested time slot is already booked or overlaps with an existing reservation."
      );
    }
    throw error;
  }
}

export type PublicBookingResponse = Omit<BookingResponse, "cancellationKey">;

/**
 * Retrieves a public booking by ID (sensitive fields such as cancellationKey are omitted).
 */
export async function getBookingById(bookingId: string): Promise<PublicBookingResponse> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      host: { select: { id: true, name: true, email: true, slug: true, timezone: true } },
      eventType: {
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          duration: true,
          bufferBefore: true,
          bufferAfter: true,
          location: true,
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError(`Booking with id '${bookingId}' not found.`);
  }

  return {
    id: booking.id,
    hostId: booking.hostId,
    eventTypeId: booking.eventTypeId,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    startAt: DateTime.fromJSDate(booking.startAt, { zone: "utc" }).toISO()!,
    endAt: DateTime.fromJSDate(booking.endAt, { zone: "utc" }).toISO()!,
    reservedStartAt: DateTime.fromJSDate(booking.reservedStartAt, { zone: "utc" }).toISO()!,
    reservedEndAt: DateTime.fromJSDate(booking.reservedEndAt, { zone: "utc" }).toISO()!,
    status: booking.status,
    cancellationReason: booking.cancellationReason,
    createdAt: DateTime.fromJSDate(booking.createdAt, { zone: "utc" }).toISO()!,
    updatedAt: DateTime.fromJSDate(booking.updatedAt, { zone: "utc" }).toISO()!,
    host: booking.host,
    eventType: booking.eventType,
  };
}


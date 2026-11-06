import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BookingStatus, NotificationStatus, NotificationType } from "@prisma/client";
import { CancelBookingInput } from "@/lib/validations/booking.schema";
import {
  NotFoundError,
  UnauthorizedError,
  InvalidStateTransitionError,
} from "@/lib/errors";
import { BookingResponse } from "@/lib/services/booking.service";

/**
 * Cancels a booking securely with authorization validation, notification updates,
 * and immediate slot release.
 */
export async function cancelBooking(
  bookingId: string,
  input: CancelBookingInput,
  overrideNowUtc?: DateTime
): Promise<BookingResponse> {
  const now = overrideNowUtc ?? DateTime.utc();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      host: { select: { id: true, name: true, email: true, timezone: true } },
      eventType: {
        select: {
          id: true,
          title: true,
          slug: true,
          duration: true,
          bufferBefore: true,
          bufferAfter: true,
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError(`Booking with id '${bookingId}' not found.`);
  }

  // 1. Secure authorization check (prevents cancellation by ID guessing)
  if (booking.cancellationKey !== input.cancellationKey) {
    throw new UnauthorizedError("Unauthorized to cancel this booking: invalid cancellationKey provided.");
  }

  // 2. State transition validation
  if (booking.status === BookingStatus.CANCELLED) {
    throw new InvalidStateTransitionError("Booking is already cancelled.");
  }

  if (booking.status === BookingStatus.COMPLETED) {
    throw new InvalidStateTransitionError("Cannot cancel a completed booking.");
  }

  // 3. Transactional cancellation and notification updates
  const updatedBooking = await prisma.$transaction(async (tx) => {
    // A. Update booking status and record cancellation reason
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: input.reason?.trim() || "Cancelled by guest",
      },
      include: {
        host: { select: { id: true, name: true, email: true, timezone: true } },
        eventType: {
          select: {
            id: true,
            title: true,
            slug: true,
            duration: true,
            bufferBefore: true,
            bufferAfter: true,
          },
        },
      },
    });

    // B. Cancel any scheduled reminder notifications
    await tx.notification.updateMany({
      where: {
        bookingId: booking.id,
        status: NotificationStatus.SCHEDULED,
      },
      data: {
        status: NotificationStatus.CANCELLED,
      },
    });

    // C. Create CANCELLATION notification record
    await tx.notification.create({
      data: {
        bookingId: booking.id,
        type: NotificationType.CANCELLATION,
        status: NotificationStatus.SENT,
        scheduledAt: now.toJSDate(),
        sentAt: now.toJSDate(),
      },
    });

    return updated;
  });

  return {
    id: updatedBooking.id,
    hostId: updatedBooking.hostId,
    eventTypeId: updatedBooking.eventTypeId,
    guestName: updatedBooking.guestName,
    guestEmail: updatedBooking.guestEmail,
    startAt: DateTime.fromJSDate(updatedBooking.startAt, { zone: "utc" }).toISO()!,
    endAt: DateTime.fromJSDate(updatedBooking.endAt, { zone: "utc" }).toISO()!,
    reservedStartAt: DateTime.fromJSDate(updatedBooking.reservedStartAt, { zone: "utc" }).toISO()!,
    reservedEndAt: DateTime.fromJSDate(updatedBooking.reservedEndAt, { zone: "utc" }).toISO()!,
    status: updatedBooking.status,
    cancellationKey: updatedBooking.cancellationKey,
    createdAt: DateTime.fromJSDate(updatedBooking.createdAt, { zone: "utc" }).toISO()!,
    updatedAt: DateTime.fromJSDate(updatedBooking.updatedAt, { zone: "utc" }).toISO()!,
    host: updatedBooking.host,
    eventType: updatedBooking.eventType,
  };
}


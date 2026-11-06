import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BookingStatus, NotificationStatus, NotificationType } from "@prisma/client";
import { NotFoundError, UnauthorizedError, InvalidStateTransitionError } from "@/lib/errors";

export interface ListBookingsParams {
  hostId: string;
  hostTimezone: string;
  search?: string;
  status?: BookingStatus | "ALL";
  eventTypeId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  sortBy?: "upcoming" | "recent" | "created";
  page?: number;
  limit?: number;
}

export async function listBookingsForHost(params: ListBookingsParams) {
  const {
    hostId,
    hostTimezone,
    search,
    status,
    eventTypeId,
    dateFrom,
    dateTo,
    sortBy = "upcoming",
    page = 1,
    limit = 10,
  } = params;

  const whereClause: Record<string, unknown> = { hostId };

  if (status && status !== "ALL") {
    whereClause.status = status;
  }

  if (eventTypeId) {
    whereClause.eventTypeId = eventTypeId;
  }

  if (search && search.trim()) {
    const term = search.trim();
    whereClause.OR = [
      { guestName: { contains: term, mode: "insensitive" } },
      { guestEmail: { contains: term, mode: "insensitive" } },
    ];
  }

  if (dateFrom) {
    const fromUtc = DateTime.fromISO(`${dateFrom}T00:00:00`, { zone: hostTimezone }).toUTC().toJSDate();
    whereClause.startAt = { ...(whereClause.startAt as object || {}), gte: fromUtc };
  }

  if (dateTo) {
    const toUtc = DateTime.fromISO(`${dateTo}T23:59:59.999`, { zone: hostTimezone }).toUTC().toJSDate();
    whereClause.startAt = { ...(whereClause.startAt as object || {}), lte: toUtc };
  }

  // Determine sort order
  let orderBy: Record<string, "asc" | "desc"> = { startAt: "asc" };
  if (sortBy === "recent") {
    orderBy = { startAt: "desc" };
  } else if (sortBy === "created") {
    orderBy = { createdAt: "desc" };
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [totalCount, items] = await Promise.all([
    prisma.booking.count({ where: whereClause }),
    prisma.booking.findMany({
      where: whereClause,
      include: {
        eventType: {
          select: {
            id: true,
            title: true,
            slug: true,
            duration: true,
            location: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  const formattedBookings = items.map((b) => {
    const startDt = DateTime.fromJSDate(b.startAt, { zone: hostTimezone });
    const endDt = DateTime.fromJSDate(b.endAt, { zone: hostTimezone });

    return {
      id: b.id,
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      status: b.status,
      cancellationReason: b.cancellationReason,
      startAtUtc: DateTime.fromJSDate(b.startAt, { zone: "utc" }).toISO()!,
      endAtUtc: DateTime.fromJSDate(b.endAt, { zone: "utc" }).toISO()!,
      createdAtUtc: DateTime.fromJSDate(b.createdAt, { zone: "utc" }).toISO()!,
      formattedDate: startDt.toFormat("EEE, MMM d, yyyy"),
      formattedTime: `${startDt.toFormat("HH:mm")} – ${endDt.toFormat("HH:mm")}`,
      eventType: b.eventType,
    };
  });

  return {
    bookings: formattedBookings,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

export async function getBookingDetailsForHost(
  hostId: string,
  bookingId: string,
  hostTimezone: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
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
      notifications: {
        select: {
          id: true,
          type: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError(`Booking with id '${bookingId}' not found.`);
  }

  if (booking.hostId !== hostId) {
    throw new UnauthorizedError("You do not have permission to view or manage this booking.");
  }

  const startDt = DateTime.fromJSDate(booking.startAt, { zone: hostTimezone });
  const endDt = DateTime.fromJSDate(booking.endAt, { zone: hostTimezone });
  const reservedStartDt = DateTime.fromJSDate(booking.reservedStartAt, { zone: hostTimezone });
  const reservedEndDt = DateTime.fromJSDate(booking.reservedEndAt, { zone: hostTimezone });

  return {
    id: booking.id,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    status: booking.status,
    cancellationReason: booking.cancellationReason,
    startAtUtc: DateTime.fromJSDate(booking.startAt, { zone: "utc" }).toISO()!,
    endAtUtc: DateTime.fromJSDate(booking.endAt, { zone: "utc" }).toISO()!,
    reservedStartAtUtc: DateTime.fromJSDate(booking.reservedStartAt, { zone: "utc" }).toISO()!,
    reservedEndAtUtc: DateTime.fromJSDate(booking.reservedEndAt, { zone: "utc" }).toISO()!,
    createdAtUtc: DateTime.fromJSDate(booking.createdAt, { zone: "utc" }).toISO()!,
    formattedDate: startDt.toFormat("EEEE, MMMM d, yyyy"),
    formattedTime: `${startDt.toFormat("HH:mm")} – ${endDt.toFormat("HH:mm")}`,
    formattedReservedTime: `${reservedStartDt.toFormat("HH:mm")} – ${reservedEndDt.toFormat("HH:mm")}`,
    eventType: booking.eventType,
    notifications: booking.notifications.map((n) => ({
      id: n.id,
      type: n.type,
      status: n.status,
      scheduledAt: DateTime.fromJSDate(n.scheduledAt, { zone: hostTimezone }).toFormat("MMM d, HH:mm"),
      sentAt: n.sentAt ? DateTime.fromJSDate(n.sentAt, { zone: hostTimezone }).toFormat("MMM d, HH:mm") : null,
    })),
  };
}

export async function cancelBookingAsHost(
  hostId: string,
  bookingId: string,
  reason?: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new NotFoundError(`Booking with id '${bookingId}' not found.`);
  }

  if (booking.hostId !== hostId) {
    throw new UnauthorizedError("You do not have permission to cancel this booking.");
  }

  if (booking.status === BookingStatus.CANCELLED) {
    throw new InvalidStateTransitionError("This booking is already cancelled.");
  }

  if (booking.status === BookingStatus.COMPLETED) {
    throw new InvalidStateTransitionError("Cannot cancel a completed booking.");
  }

  const now = new Date();

  // Transactionally cancel booking, update notifications, and release slot
  const updatedBooking = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: reason?.trim() || "Cancelled by host",
      },
      include: {
        eventType: { select: { title: true } },
      },
    });

    // Cancel any scheduled reminder notifications
    await tx.notification.updateMany({
      where: {
        bookingId,
        status: NotificationStatus.SCHEDULED,
      },
      data: {
        status: NotificationStatus.CANCELLED,
      },
    });

    // Create host cancellation notification record
    await tx.notification.create({
      data: {
        bookingId,
        type: NotificationType.CANCELLATION,
        status: NotificationStatus.SENT,
        scheduledAt: now,
        sentAt: now,
      },
    });

    return updated;
  });

  return {
    success: true,
    message: "Booking cancelled successfully. The reserved time slot has been released.",
    booking: {
      id: updatedBooking.id,
      status: updatedBooking.status,
      cancellationReason: updatedBooking.cancellationReason,
      updatedAt: updatedBooking.updatedAt.toISOString(),
    },
  };
}


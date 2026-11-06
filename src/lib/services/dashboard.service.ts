import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";

export interface DashboardOverviewData {
  stats: {
    totalBookings: number;
    upcomingBookings: number;
    completedBookings: number;
    cancelledBookings: number;
  };
  upcomingAppointments: Array<{
    id: string;
    guestName: string;
    guestEmail: string;
    eventTitle: string;
    duration: number;
    startAtUtc: string;
    formattedDate: string;
    formattedTime: string;
    location: string | null;
  }>;
  recentBookings: Array<{
    id: string;
    guestName: string;
    guestEmail: string;
    eventTitle: string;
    status: BookingStatus;
    startAtUtc: string;
    formattedDateTime: string;
  }>;
}

export async function getDashboardOverview(
  hostId: string,
  hostTimezone: string
): Promise<DashboardOverviewData> {
  const now = new Date();

  // Aggregate stats
  const [totalBookings, upcomingCount, completedCount, cancelledCount] = await Promise.all([
    prisma.booking.count({ where: { hostId } }),
    prisma.booking.count({
      where: {
        hostId,
        status: BookingStatus.CONFIRMED,
        startAt: { gte: now },
      },
    }),
    prisma.booking.count({
      where: {
        hostId,
        OR: [
          { status: BookingStatus.COMPLETED },
          { status: BookingStatus.CONFIRMED, endAt: { lt: now } },
        ],
      },
    }),
    prisma.booking.count({
      where: {
        hostId,
        status: BookingStatus.CANCELLED,
      },
    }),
  ]);

  // Fetch upcoming scheduled appointments (limit 5)
  const upcomingRaw = await prisma.booking.findMany({
    where: {
      hostId,
      status: BookingStatus.CONFIRMED,
      startAt: { gte: now },
    },
    include: {
      eventType: {
        select: {
          title: true,
          duration: true,
          location: true,
        },
      },
    },
    orderBy: {
      startAt: "asc",
    },
    take: 5,
  });

  const upcomingAppointments = upcomingRaw.map((b) => {
    const startDt = DateTime.fromJSDate(b.startAt, { zone: hostTimezone });
    const endDt = DateTime.fromJSDate(b.endAt, { zone: hostTimezone });

    return {
      id: b.id,
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      eventTitle: b.eventType.title,
      duration: b.eventType.duration,
      startAtUtc: DateTime.fromJSDate(b.startAt, { zone: "utc" }).toISO()!,
      formattedDate: startDt.toFormat("EEE, MMM d, yyyy"),
      formattedTime: `${startDt.toFormat("HH:mm")} – ${endDt.toFormat("HH:mm")}`,
      location: b.eventType.location,
    };
  });

  // Fetch recent bookings (limit 6)
  const recentRaw = await prisma.booking.findMany({
    where: { hostId },
    include: {
      eventType: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 6,
  });

  const recentBookings = recentRaw.map((b) => {
    const startDt = DateTime.fromJSDate(b.startAt, { zone: hostTimezone });

    return {
      id: b.id,
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      eventTitle: b.eventType.title,
      status: b.status,
      startAtUtc: DateTime.fromJSDate(b.startAt, { zone: "utc" }).toISO()!,
      formattedDateTime: `${startDt.toFormat("MMM d, yyyy")} at ${startDt.toFormat("HH:mm")}`,
    };
  });

  return {
    stats: {
      totalBookings,
      upcomingBookings: upcomingCount,
      completedBookings: completedCount,
      cancelledBookings: cancelledCount,
    },
    upcomingAppointments,
    recentBookings,
  };
}


import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BookingStatus, DayOfWeek } from "@prisma/client";
import {
  luxonWeekdayToDayOfWeek,
  extractTimeFromDb,
  combineDateAndTimeInZone,
  intervalsOverlap,
} from "@/lib/utils/time";
import { NotFoundError, ValidationError } from "@/lib/errors";

export interface AvailableSlot {
  startAt: string;       // ISO-8601 UTC string
  endAt: string;         // ISO-8601 UTC string
  localStart: string;    // HH:mm formatted in host timezone
  localEnd: string;      // HH:mm formatted in host timezone
  hostTimezone: string;
  duration: number;      // in minutes
  bufferBefore: number;  // in minutes
  bufferAfter: number;   // in minutes
}

export interface GetSlotsParams {
  hostId: string;
  eventTypeId: string;
  date: string;          // YYYY-MM-DD
  nowUtc?: DateTime;     // optional override for testing past slot filtering
  slotStepMinutes?: number; // optional step interval for slot start times
}

export interface WorkingWindow {
  windowStart: DateTime;
  windowEnd: DateTime;
}

/**
 * Loads Host and EventType and validates relationship and active status.
 */
export async function getHostAndEventType(hostId: string, eventTypeId: string) {
  const host = await prisma.host.findUnique({
    where: { id: hostId },
  });

  if (!host) {
    throw new NotFoundError(`Host with id '${hostId}' not found.`);
  }

  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId },
  });

  if (!eventType) {
    throw new NotFoundError(`EventType with id '${eventTypeId}' not found.`);
  }

  if (eventType.hostId !== host.id) {
    throw new ValidationError(`EventType '${eventTypeId}' does not belong to host '${hostId}'.`);
  }

  if (!eventType.isActive) {
    throw new ValidationError(`EventType '${eventType.title}' is currently inactive.`);
  }

  return { host, eventType };
}

/**
 * Resolves the effective working windows for a host on a specific date.
 * Date overrides take complete precedence over weekly availability.
 */
export async function getEffectiveWindows(
  hostId: string,
  hostTimezone: string,
  dateIso: string
): Promise<WorkingWindow[]> {
  const targetDateLuxon = DateTime.fromISO(dateIso, { zone: hostTimezone });
  if (!targetDateLuxon.isValid) {
    throw new ValidationError(`Invalid date format: ${dateIso}. Expected YYYY-MM-DD.`);
  }

  // PostgreSQL DATE query matches calendar day
  const dateObj = new Date(`${dateIso}T00:00:00.000Z`);

  // 1. Check Date Overrides
  const overrides = await prisma.dateOverride.findMany({
    where: {
      hostId,
      date: dateObj,
    },
  });

  if (overrides.length > 0) {
    // If any override marks the day unavailable, the whole day is blocked
    const isDayUnavailable = overrides.some((o) => o.isUnavailable);
    if (isDayUnavailable) {
      return [];
    }

    // Collect custom windows from overrides
    const customWindows: WorkingWindow[] = [];
    for (const override of overrides) {
      if (override.startTime && override.endTime) {
        const start = combineDateAndTimeInZone(dateIso, extractTimeFromDb(override.startTime), hostTimezone);
        const end = combineDateAndTimeInZone(dateIso, extractTimeFromDb(override.endTime), hostTimezone);
        if (end > start) {
          customWindows.push({ windowStart: start, windowEnd: end });
        }
      }
    }
    return customWindows;
  }

  // 2. Fall back to recurring weekly Availability
  const dayOfWeekEnum: DayOfWeek = luxonWeekdayToDayOfWeek(targetDateLuxon.weekday);

  const weeklyAvailabilities = await prisma.availability.findMany({
    where: {
      hostId,
      dayOfWeek: dayOfWeekEnum,
    },
    orderBy: {
      startTime: "asc",
    },
  });

  const windows: WorkingWindow[] = [];
  for (const avail of weeklyAvailabilities) {
    const start = combineDateAndTimeInZone(dateIso, extractTimeFromDb(avail.startTime), hostTimezone);
    const end = combineDateAndTimeInZone(dateIso, extractTimeFromDb(avail.endTime), hostTimezone);
    if (end > start) {
      windows.push({ windowStart: start, windowEnd: end });
    }
  }

  return windows;
}

/**
 * Generates all valid, non-overlapping available booking slots for a requested date.
 * Respects duration, buffers, schedules, overrides, existing bookings and past times.
 */
export async function getAvailableSlots(params: GetSlotsParams): Promise<{
  host: { id: string; name: string; timezone: string };
  eventType: { id: string; title: string; slug: string; duration: number; bufferBefore: number; bufferAfter: number };
  date: string;
  slots: AvailableSlot[];
}> {
  const { hostId, eventTypeId, date, nowUtc = DateTime.utc(), slotStepMinutes } = params;

  const { host, eventType } = await getHostAndEventType(hostId, eventTypeId);

  const windows = await getEffectiveWindows(host.id, host.timezone, date);
  if (windows.length === 0) {
    return {
      host: { id: host.id, name: host.name, timezone: host.timezone },
      eventType: {
        id: eventType.id,
        title: eventType.title,
        slug: eventType.slug,
        duration: eventType.duration,
        bufferBefore: eventType.bufferBefore,
        bufferAfter: eventType.bufferAfter,
      },
      date,
      slots: [],
    };
  }

  // Load active bookings that could overlap with slots on this date
  // A booking active in UTC that overlaps with any of the working windows
  const earliestWindowStart = windows.reduce((min, w) => (w.windowStart < min ? w.windowStart : min), windows[0].windowStart);
  const latestWindowEnd = windows.reduce((max, w) => (w.windowEnd > max ? w.windowEnd : max), windows[0].windowEnd);

  // Search range expanded by event buffers
  const queryRangeStart = earliestWindowStart.minus({ minutes: eventType.bufferAfter + 60 }).toJSDate();
  const queryRangeEnd = latestWindowEnd.plus({ minutes: eventType.bufferBefore + 60 }).toJSDate();

  const existingBookings = await prisma.booking.findMany({
    where: {
      hostId: host.id,
      status: { not: BookingStatus.CANCELLED },
      reservedStartAt: { lt: queryRangeEnd },
      reservedEndAt: { gt: queryRangeStart },
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      reservedStartAt: true,
      reservedEndAt: true,
    },
  });

  // Convert existing bookings to Luxon intervals in UTC
  const occupiedIntervals = existingBookings.map((b) => ({
    reservedStart: DateTime.fromJSDate(b.reservedStartAt, { zone: "utc" }),
    reservedEnd: DateTime.fromJSDate(b.reservedEndAt, { zone: "utc" }),
  }));

  const step = slotStepMinutes && slotStepMinutes > 0 ? slotStepMinutes : eventType.duration;
  const availableSlots: AvailableSlot[] = [];

  for (const window of windows) {
    let currentSlotStart = window.windowStart;

    while (currentSlotStart.plus({ minutes: eventType.duration }) <= window.windowEnd) {
      const currentSlotEnd = currentSlotStart.plus({ minutes: eventType.duration });

      // Convert slot boundary to UTC for universal instant comparisons
      const slotStartUtc = currentSlotStart.toUTC();
      const slotEndUtc = currentSlotEnd.toUTC();

      // Buffer-adjusted reservation interval for this candidate slot
      const candidateReservedStart = slotStartUtc.minus({ minutes: eventType.bufferBefore });
      const candidateReservedEnd = slotEndUtc.plus({ minutes: eventType.bufferAfter });

      // 1. Past slots check (candidate slot start must be strictly in the future relative to now)
      const isFutureSlot = slotStartUtc > nowUtc;

      // 2. Overlap check against all active booking reserved intervals
      const isOccupied = occupiedIntervals.some((occ) =>
        intervalsOverlap(candidateReservedStart, candidateReservedEnd, occ.reservedStart, occ.reservedEnd)
      );

      if (isFutureSlot && !isOccupied) {
        availableSlots.push({
          startAt: slotStartUtc.toISO()!,
          endAt: slotEndUtc.toISO()!,
          localStart: currentSlotStart.toFormat("HH:mm"),
          localEnd: currentSlotEnd.toFormat("HH:mm"),
          hostTimezone: host.timezone,
          duration: eventType.duration,
          bufferBefore: eventType.bufferBefore,
          bufferAfter: eventType.bufferAfter,
        });
      }

      currentSlotStart = currentSlotStart.plus({ minutes: step });
    }
  }

  return {
    host: { id: host.id, name: host.name, timezone: host.timezone },
    eventType: {
      id: eventType.id,
      title: eventType.title,
      slug: eventType.slug,
      duration: eventType.duration,
      bufferBefore: eventType.bufferBefore,
      bufferAfter: eventType.bufferAfter,
    },
    date,
    slots: availableSlots,
  };
}


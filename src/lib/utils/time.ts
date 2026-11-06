import { DateTime } from "luxon";
import { DayOfWeek } from "@prisma/client";
import crypto from "crypto";

/**
 * Maps Luxon weekday (1 = Monday, ..., 7 = Sunday) to Prisma DayOfWeek enum.
 */
export function luxonWeekdayToDayOfWeek(weekday: number): DayOfWeek {
  switch (weekday) {
    case 1:
      return DayOfWeek.MONDAY;
    case 2:
      return DayOfWeek.TUESDAY;
    case 3:
      return DayOfWeek.WEDNESDAY;
    case 4:
      return DayOfWeek.THURSDAY;
    case 5:
      return DayOfWeek.FRIDAY;
    case 6:
      return DayOfWeek.SATURDAY;
    case 7:
      return DayOfWeek.SUNDAY;
    default:
      throw new Error(`Invalid weekday index: ${weekday}`);
  }
}

/**
 * Extracts { hour, minute } from a Date object returned by Prisma for a @db.Time column.
 */
export function extractTimeFromDb(timeDate: Date): { hour: number; minute: number } {
  return {
    hour: timeDate.getUTCHours(),
    minute: timeDate.getUTCMinutes(),
  };
}

/**
 * Combines a calendar date (YYYY-MM-DD) and time (hour, minute) in an IANA timezone into a Luxon DateTime.
 * Handles Daylight Saving Time (DST) automatically through Luxon's IANA zone support.
 */
export function combineDateAndTimeInZone(
  dateIso: string,
  time: { hour: number; minute: number },
  zone: string
): DateTime {
  const [yearStr, monthStr, dayStr] = dateIso.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const dt = DateTime.fromObject(
    {
      year,
      month,
      day,
      hour: time.hour,
      minute: time.minute,
      second: 0,
      millisecond: 0,
    },
    { zone }
  );

  if (!dt.isValid) {
    throw new Error(`Invalid date/time combination: ${dateIso} ${time.hour}:${time.minute} in ${zone} (${dt.invalidReason})`);
  }

  return dt;
}

/**
 * Checks whether two half-open intervals [start1, end1) and [start2, end2) overlap.
 */
export function intervalsOverlap(
  start1: DateTime,
  end1: DateTime,
  start2: DateTime,
  end2: DateTime
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Converts a "HH:mm" 24-hour time string into a 1970-01-01 UTC Date suitable for @db.Time columns.
 */
export function timeStringToDbDate(timeStr: string): Date {
  const parts = timeStr.split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm.`);
  }
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time values: ${timeStr}. Hours must be 0-23 and minutes 0-59.`);
  }
  const paddedH = String(hour).padStart(2, "0");
  const paddedM = String(minute).padStart(2, "0");
  return new Date(`1970-01-01T${paddedH}:${paddedM}:00.000Z`);
}

/**
 * Formats a Date object from a @db.Time column into a "HH:mm" string.
 */
export function formatTimeFromDb(timeDate: Date): string {
  const h = String(timeDate.getUTCHours()).padStart(2, "0");
  const m = String(timeDate.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Converts "HH:mm" into total minutes from start of day (e.g. "09:30" -> 570).
 */
export function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Checks whether two time intervals overlap on the same day.
 */
export function timeRangesOverlap(
  start1Min: number,
  end1Min: number,
  start2Min: number,
  end2Min: number
): boolean {
  return start1Min < end2Min && start2Min < end1Min;
}

/**
 * Hashes a request payload into a deterministic SHA-256 string for idempotency comparisons.
 */
export function hashPayload(payload: unknown): string {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload, Object.keys(payload as object).sort());
  return crypto.createHash("sha256").update(str).digest("hex");
}

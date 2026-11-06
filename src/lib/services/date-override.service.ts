import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { DateOverrideInput } from "@/lib/validations/date-override.schema";
import {
  formatTimeFromDb,
  timeStringToDbDate,
  timeStringToMinutes,
} from "@/lib/utils/time";

export interface FormattedDateOverride {
  id: string;
  hostId: string;
  date: string; // YYYY-MM-DD
  isUnavailable: boolean;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
}

export async function listDateOverridesForHost(
  hostId: string
): Promise<FormattedDateOverride[]> {
  const records = await prisma.dateOverride.findMany({
    where: { hostId },
    orderBy: { date: "asc" },
  });

  return records.map((r) => ({
    id: r.id,
    hostId: r.hostId,
    date: r.date.toISOString().split("T")[0],
    isUnavailable: r.isUnavailable,
    startTime: r.startTime ? formatTimeFromDb(r.startTime) : null,
    endTime: r.endTime ? formatTimeFromDb(r.endTime) : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getDateOverrideForHost(hostId: string, overrideId: string) {
  const override = await prisma.dateOverride.findUnique({
    where: { id: overrideId },
  });

  if (!override) {
    throw new NotFoundError(`Date exception with id '${overrideId}' not found.`);
  }

  if (override.hostId !== hostId) {
    throw new UnauthorizedError("You do not have permission to view or edit this date exception.");
  }

  return override;
}

export async function checkOverrideConflicts(
  hostId: string,
  hostTimezone: string,
  dateIso: string,
  isUnavailable: boolean,
  startTimeStr?: string | null,
  endTimeStr?: string | null
) {
  // Determine bounds of this calendar day in host timezone
  const dayStartLuxon = DateTime.fromISO(`${dateIso}T00:00:00`, { zone: hostTimezone }).toUTC();
  const dayEndLuxon = dayStartLuxon.plus({ days: 1 });

  const existingBookings = await prisma.booking.findMany({
    where: {
      hostId,
      status: BookingStatus.CONFIRMED,
      startAt: { gte: dayStartLuxon.toJSDate() },
      endAt: { lte: dayEndLuxon.toJSDate() },
    },
    include: {
      eventType: { select: { title: true } },
    },
  });

  if (existingBookings.length === 0) {
    return [];
  }

  // If the whole day is marked unavailable, all bookings on this day conflict
  if (isUnavailable) {
    return existingBookings.map((b) => {
      const bStart = DateTime.fromJSDate(b.startAt, { zone: hostTimezone });
      const bEnd = DateTime.fromJSDate(b.endAt, { zone: hostTimezone });
      return {
        id: b.id,
        guestName: b.guestName,
        guestEmail: b.guestEmail,
        eventTitle: b.eventType.title,
        formattedTime: `${bStart.toFormat("HH:mm")} – ${bEnd.toFormat("HH:mm")}`,
      };
    });
  }

  // If custom working hours are provided, check which bookings fall outside the new custom window
  if (startTimeStr && endTimeStr) {
    const customStartMin = timeStringToMinutes(startTimeStr);
    const customEndMin = timeStringToMinutes(endTimeStr);

    const outsideBookings = existingBookings.filter((b) => {
      const bStart = DateTime.fromJSDate(b.startAt, { zone: hostTimezone });
      const bEnd = DateTime.fromJSDate(b.endAt, { zone: hostTimezone });
      const bStartMin = bStart.hour * 60 + bStart.minute;
      const bEndMin = bEnd.hour * 60 + bEnd.minute;

      return bStartMin < customStartMin || bEndMin > customEndMin;
    });

    return outsideBookings.map((b) => {
      const bStart = DateTime.fromJSDate(b.startAt, { zone: hostTimezone });
      const bEnd = DateTime.fromJSDate(b.endAt, { zone: hostTimezone });
      return {
        id: b.id,
        guestName: b.guestName,
        guestEmail: b.guestEmail,
        eventTitle: b.eventType.title,
        formattedTime: `${bStart.toFormat("HH:mm")} – ${bEnd.toFormat("HH:mm")}`,
      };
    });
  }

  return [];
}

export async function createDateOverrideForHost(
  hostId: string,
  hostTimezone: string,
  input: DateOverrideInput
) {
  // If not explicitly forced, check if this conflicts with already confirmed appointments
  if (!input.force) {
    const conflicts = await checkOverrideConflicts(
      hostId,
      hostTimezone,
      input.date,
      input.isUnavailable,
      input.startTime,
      input.endTime
    );

    if (conflicts.length > 0) {
      return {
        requiresConfirmation: true,
        conflicts,
        message: `There are ${conflicts.length} confirmed booking(s) on ${input.date} that conflict with this schedule change. Adding this exception will NOT cancel existing bookings, but will restrict new bookings.`,
      };
    }
  }

  const dateObj = new Date(`${input.date}T00:00:00.000Z`);
  const startTimeDate = input.startTime ? timeStringToDbDate(input.startTime) : null;
  const endTimeDate = input.endTime ? timeStringToDbDate(input.endTime) : null;

  const created = await prisma.dateOverride.create({
    data: {
      hostId,
      date: dateObj,
      isUnavailable: input.isUnavailable,
      startTime: input.isUnavailable ? null : startTimeDate,
      endTime: input.isUnavailable ? null : endTimeDate,
    },
  });

  return {
    requiresConfirmation: false,
    override: {
      id: created.id,
      hostId: created.hostId,
      date: input.date,
      isUnavailable: created.isUnavailable,
      startTime: created.startTime ? formatTimeFromDb(created.startTime) : null,
      endTime: created.endTime ? formatTimeFromDb(created.endTime) : null,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export async function updateDateOverrideForHost(
  hostId: string,
  overrideId: string,
  hostTimezone: string,
  input: DateOverrideInput
) {
  await getDateOverrideForHost(hostId, overrideId);

  if (!input.force) {
    const conflicts = await checkOverrideConflicts(
      hostId,
      hostTimezone,
      input.date,
      input.isUnavailable,
      input.startTime,
      input.endTime
    );

    if (conflicts.length > 0) {
      return {
        requiresConfirmation: true,
        conflicts,
        message: `There are ${conflicts.length} confirmed booking(s) on ${input.date} that conflict with this schedule change.`,
      };
    }
  }

  const dateObj = new Date(`${input.date}T00:00:00.000Z`);
  const startTimeDate = input.startTime ? timeStringToDbDate(input.startTime) : null;
  const endTimeDate = input.endTime ? timeStringToDbDate(input.endTime) : null;

  const updated = await prisma.dateOverride.update({
    where: { id: overrideId },
    data: {
      date: dateObj,
      isUnavailable: input.isUnavailable,
      startTime: input.isUnavailable ? null : startTimeDate,
      endTime: input.isUnavailable ? null : endTimeDate,
    },
  });

  return {
    requiresConfirmation: false,
    override: {
      id: updated.id,
      hostId: updated.hostId,
      date: input.date,
      isUnavailable: updated.isUnavailable,
      startTime: updated.startTime ? formatTimeFromDb(updated.startTime) : null,
      endTime: updated.endTime ? formatTimeFromDb(updated.endTime) : null,
      createdAt: updated.createdAt.toISOString(),
    },
  };
}

export async function deleteDateOverrideForHost(hostId: string, overrideId: string) {
  await getDateOverrideForHost(hostId, overrideId);

  await prisma.dateOverride.delete({
    where: { id: overrideId },
  });

  return { success: true, message: "Date exception removed. Weekly availability restored for this date." };
}

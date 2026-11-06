import { prisma } from "@/lib/prisma";
import { DayOfWeek } from "@prisma/client";
import {
  WeeklyAvailabilityInput,
  DayScheduleInput,
} from "@/lib/validations/availability.schema";
import { formatTimeFromDb, timeStringToDbDate } from "@/lib/utils/time";

const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

export async function getHostWeeklyAvailability(
  hostId: string
): Promise<{ schedules: DayScheduleInput[] }> {
  const existingRows = await prisma.availability.findMany({
    where: { hostId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const schedules: DayScheduleInput[] = ALL_DAYS.map((day) => {
    const dayRows = existingRows.filter((r) => r.dayOfWeek === day);
    const windows = dayRows.map((r) => ({
      startTime: formatTimeFromDb(r.startTime),
      endTime: formatTimeFromDb(r.endTime),
    }));

    return {
      dayOfWeek: day,
      isEnabled: windows.length > 0,
      windows: windows.length > 0 ? windows : [{ startTime: "09:00", endTime: "17:00" }],
    };
  });

  return { schedules };
}

export async function updateHostWeeklyAvailability(
  hostId: string,
  input: WeeklyAvailabilityInput
): Promise<{ schedules: DayScheduleInput[] }> {
  // Execute within transaction: replace existing weekly availability with new windows
  await prisma.$transaction(async (tx) => {
    // 1. Remove current availability
    await tx.availability.deleteMany({
      where: { hostId },
    });

    // 2. Prepare new records for enabled days
    const recordsToCreate: Array<{
      hostId: string;
      dayOfWeek: DayOfWeek;
      startTime: Date;
      endTime: Date;
    }> = [];

    for (const daySchedule of input.schedules) {
      if (!daySchedule.isEnabled) continue;

      for (const win of daySchedule.windows) {
        recordsToCreate.push({
          hostId,
          dayOfWeek: daySchedule.dayOfWeek,
          startTime: timeStringToDbDate(win.startTime),
          endTime: timeStringToDbDate(win.endTime),
        });
      }
    }

    if (recordsToCreate.length > 0) {
      await tx.availability.createMany({
        data: recordsToCreate,
      });
    }
  });

  return getHostWeeklyAvailability(hostId);
}


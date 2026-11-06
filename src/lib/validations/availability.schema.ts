import { z } from "zod";
import { DayOfWeek } from "@prisma/client";
import { timeStringToMinutes, timeRangesOverlap } from "@/lib/utils/time";

export const TimeWindowSchema = z.object({
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in 24-hour HH:mm format (e.g. 09:00)."),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in 24-hour HH:mm format (e.g. 17:00)."),
});

export type TimeWindowInput = z.infer<typeof TimeWindowSchema>;

export const DayScheduleSchema = z.object({
  dayOfWeek: z.nativeEnum(DayOfWeek),
  isEnabled: z.boolean(),
  windows: z.array(TimeWindowSchema).default([]),
});

export type DayScheduleInput = z.infer<typeof DayScheduleSchema>;

export const WeeklyAvailabilitySchema = z
  .object({
    schedules: z.array(DayScheduleSchema),
  })
  .superRefine((data, ctx) => {
    for (const [dayIdx, day] of data.schedules.entries()) {
      if (!day.isEnabled || day.windows.length === 0) continue;

      for (const [winIdx, win] of day.windows.entries()) {
        const startMin = timeStringToMinutes(win.startTime);
        const endMin = timeStringToMinutes(win.endTime);

        if (startMin >= endMin) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Start time (${win.startTime}) must be strictly before end time (${win.endTime}).`,
            path: ["schedules", dayIdx, "windows", winIdx, "endTime"],
          });
        }
      }

      // Check for overlapping windows within the same weekday
      for (let i = 0; i < day.windows.length; i++) {
        for (let j = i + 1; j < day.windows.length; j++) {
          const w1 = day.windows[i];
          const w2 = day.windows[j];
          const s1 = timeStringToMinutes(w1.startTime);
          const e1 = timeStringToMinutes(w1.endTime);
          const s2 = timeStringToMinutes(w2.startTime);
          const e2 = timeStringToMinutes(w2.endTime);

          if (timeRangesOverlap(s1, e1, s2, e2)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Time windows on ${day.dayOfWeek} overlap: [${w1.startTime}–${w1.endTime}] and [${w2.startTime}–${w2.endTime}]. Windows must be non-overlapping.`,
              path: ["schedules", dayIdx, "windows", j],
            });
          }
        }
      }
    }
  });

export type WeeklyAvailabilityInput = z.infer<typeof WeeklyAvailabilitySchema>;


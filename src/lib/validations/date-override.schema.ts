import { z } from "zod";
import { timeStringToMinutes } from "@/lib/utils/time";

export const DateOverrideSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format."),
    isUnavailable: z.boolean().default(false),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be in HH:mm format.")
      .optional()
      .nullable(),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be in HH:mm format.")
      .optional()
      .nullable(),
    force: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.isUnavailable) {
      if (!data.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start time is required when setting custom working hours.",
          path: ["startTime"],
        });
      }
      if (!data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time is required when setting custom working hours.",
          path: ["endTime"],
        });
      }
      if (data.startTime && data.endTime) {
        const startMin = timeStringToMinutes(data.startTime);
        const endMin = timeStringToMinutes(data.endTime);
        if (startMin >= endMin) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Start time must be strictly before end time.",
            path: ["endTime"],
          });
        }
      }
    }
  });

export type DateOverrideInput = z.infer<typeof DateOverrideSchema>;


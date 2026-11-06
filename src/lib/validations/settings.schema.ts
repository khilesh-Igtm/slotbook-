import { z } from "zod";
import { DateTime } from "luxon";

export const HostSettingsSchema = z.object({
  name: z
    .string()
    .min(1, "Display name is required.")
    .max(100, "Display name cannot exceed 100 characters.")
    .trim(),
  timezone: z
    .string()
    .min(1, "Timezone is required.")
    .refine(
      (tz) => DateTime.now().setZone(tz).isValid,
      "Invalid IANA timezone identifier. (e.g. 'Asia/Kolkata', 'America/New_York')."
    ),
});

export type HostSettingsInput = z.infer<typeof HostSettingsSchema>;


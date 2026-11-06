import { z } from "zod";

export const EventTypeSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required.")
    .max(100, "Title cannot exceed 100 characters.")
    .trim(),
  slug: z
    .string()
    .min(1, "Slug is required.")
    .max(100, "Slug cannot exceed 100 characters.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase alphanumeric characters and single hyphens (e.g., '30-min-call')."
    )
    .trim(),
  description: z.string().max(1000, "Description cannot exceed 1000 characters.").optional().nullable(),
  duration: z
    .number()
    .int("Duration must be a whole number of minutes.")
    .min(5, "Duration must be at least 5 minutes.")
    .max(720, "Duration cannot exceed 720 minutes (12 hours)."),
  bufferBefore: z
    .number()
    .int("Buffer before must be a whole number of minutes.")
    .min(0, "Buffer before cannot be negative.")
    .max(120, "Buffer before cannot exceed 120 minutes.")
    .default(0),
  bufferAfter: z
    .number()
    .int("Buffer after must be a whole number of minutes.")
    .min(0, "Buffer after cannot be negative.")
    .max(120, "Buffer after cannot exceed 120 minutes.")
    .default(0),
  location: z.string().max(200, "Location cannot exceed 200 characters.").optional().nullable(),
  isActive: z.boolean().default(true),
});

export type EventTypeInput = z.infer<typeof EventTypeSchema>;

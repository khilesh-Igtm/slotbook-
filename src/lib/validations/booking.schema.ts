import { z } from "zod";

export const availabilityQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  timezone: z.string().optional(),
});

export const createBookingSchema = z.object({
  hostId: z.string().min(1, "hostId is required"),
  eventTypeId: z.string().min(1, "eventTypeId is required"),
  startAt: z
    .string()
    .datetime({ message: "startAt must be a valid ISO-8601 UTC timestamp string" }),
  guestName: z
    .string()
    .trim()
    .min(1, "guestName cannot be empty")
    .max(100, "guestName cannot exceed 100 characters"),
  guestEmail: z
    .string()
    .trim()
    .email("guestEmail must be a valid email address"),
});

export const cancelBookingSchema = z.object({
  cancellationKey: z.string().min(1, "cancellationKey is required for authorization"),
  reason: z.string().trim().max(500, "Reason cannot exceed 500 characters").optional(),
});

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;


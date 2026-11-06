import { NextRequest, NextResponse } from "next/server";
import { createBooking } from "@/lib/services/booking.service";
import { createBookingSchema } from "@/lib/validations/booking.schema";
import { formatErrorResponse, ValidationError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON request body.");
    }

    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Booking validation failed.", parsed.error.format());
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key") || request.headers.get("idempotency-key");

    const { booking, isIdempotentReplay } = await createBooking(parsed.data, idempotencyKey);

    return NextResponse.json(
      { booking, isIdempotentReplay },
      { status: isIdempotentReplay ? 200 : 201 }
    );
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


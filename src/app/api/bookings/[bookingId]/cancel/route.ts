import { NextRequest, NextResponse } from "next/server";
import { cancelBooking } from "@/lib/services/cancellation.service";
import { cancelBookingSchema } from "@/lib/validations/booking.schema";
import { formatErrorResponse, ValidationError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON request body.");
    }

    const parsed = cancelBookingSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Cancellation validation failed.", parsed.error.format());
    }

    const updatedBooking = await cancelBooking(bookingId, parsed.data);

    return NextResponse.json({
      message: "Booking cancelled successfully.",
      booking: updatedBooking,
    });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


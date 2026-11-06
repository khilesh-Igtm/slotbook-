import { NextRequest, NextResponse } from "next/server";
import { getBookingById } from "@/lib/services/booking.service";
import { formatErrorResponse } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const booking = await getBookingById(bookingId);
    return NextResponse.json(
      { booking },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth/session";
import { getBookingDetailsForHost } from "@/lib/services/host-booking.service";
import { formatErrorResponse } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = await requireHostSession();
    const { bookingId } = await params;

    const booking = await getBookingDetailsForHost(
      session.hostId,
      bookingId,
      session.timezone
    );
    return NextResponse.json({ booking });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


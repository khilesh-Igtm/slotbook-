import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth/session";
import { cancelBookingAsHost } from "@/lib/services/host-booking.service";
import { formatErrorResponse } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = await requireHostSession();
    const { bookingId } = await params;

    let reason: string | undefined;
    try {
      const body = await request.json();
      if (typeof body.reason === "string") {
        reason = body.reason;
      }
    } catch {
      // Body is optional
    }

    const result = await cancelBookingAsHost(session.hostId, bookingId, reason);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


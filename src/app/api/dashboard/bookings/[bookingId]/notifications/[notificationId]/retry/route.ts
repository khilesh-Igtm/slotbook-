import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth/session";
import { retryNotificationAsHost } from "@/lib/services/host-booking.service";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ bookingId: string; notificationId: string }> }
) {
  try {
    const session = await requireHostSession();
    const { bookingId, notificationId } = await params;

    const result = await retryNotificationAsHost(session.hostId, bookingId, notificationId);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: err.message } },
        { status: 401 }
      );
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: err.message } },
        { status: 400 }
      );
    }

    console.error("Failed to retry notification:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to retry notification." } },
      { status: 500 }
    );
  }
}


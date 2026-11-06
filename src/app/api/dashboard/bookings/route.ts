import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth/session";
import { listBookingsForHost } from "@/lib/services/host-booking.service";
import { BookingStatus } from "@prisma/client";
import { formatErrorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const session = await requireHostSession();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || undefined;
    const statusParam = searchParams.get("status");
    const status = (statusParam && Object.values(BookingStatus).includes(statusParam as BookingStatus))
      ? (statusParam as BookingStatus)
      : undefined;
    const eventTypeId = searchParams.get("eventTypeId") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const sortBy = (searchParams.get("sortBy") as "upcoming" | "recent" | "created") || "upcoming";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const data = await listBookingsForHost({
      hostId: session.hostId,
      hostTimezone: session.timezone,
      search,
      status,
      eventTypeId,
      dateFrom,
      dateTo,
      sortBy,
      page,
      limit,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


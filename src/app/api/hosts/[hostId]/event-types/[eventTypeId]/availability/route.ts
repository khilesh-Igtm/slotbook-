import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/services/availability.service";
import { availabilityQuerySchema } from "@/lib/validations/booking.schema";
import { formatErrorResponse, ValidationError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hostId: string; eventTypeId: string }> }
) {
  try {
    const { hostId, eventTypeId } = await params;
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");

    if (!dateParam) {
      throw new ValidationError("Query parameter 'date' (YYYY-MM-DD) is required.");
    }

    const parsedQuery = availabilityQuerySchema.safeParse({ date: dateParam });
    if (!parsedQuery.success) {
      throw new ValidationError("Invalid date format. Expected YYYY-MM-DD.", parsedQuery.error.format());
    }

    const result = await getAvailableSlots({
      hostId,
      eventTypeId,
      date: parsedQuery.data.date,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


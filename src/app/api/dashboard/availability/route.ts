import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth/session";
import { WeeklyAvailabilitySchema } from "@/lib/validations/availability.schema";
import {
  getHostWeeklyAvailability,
  updateHostWeeklyAvailability,
} from "@/lib/services/host-availability.service";
import { formatErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireHostSession();
    const data = await getHostWeeklyAvailability(session.hostId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireHostSession();
    const body = await request.json();
    const validated = WeeklyAvailabilitySchema.parse(body);

    const updated = await updateHostWeeklyAvailability(session.hostId, validated);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


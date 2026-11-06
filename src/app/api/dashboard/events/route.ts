import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth/session";
import { EventTypeSchema } from "@/lib/validations/event-type.schema";
import {
  listEventTypesForHost,
  createEventTypeForHost,
} from "@/lib/services/event-type.service";
import { formatErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireHostSession();
    const eventTypes = await listEventTypesForHost(session.hostId);
    return NextResponse.json({ eventTypes });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireHostSession();
    const body = await request.json();
    const validated = EventTypeSchema.parse(body);

    const eventType = await createEventTypeForHost(session.hostId, validated);
    return NextResponse.json({ eventType }, { status: 201 });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


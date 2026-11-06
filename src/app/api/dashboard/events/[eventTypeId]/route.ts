import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth/session";
import { EventTypeSchema } from "@/lib/validations/event-type.schema";
import {
  getEventTypeForHost,
  updateEventTypeForHost,
  deleteOrArchiveEventTypeForHost,
} from "@/lib/services/event-type.service";
import { formatErrorResponse } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventTypeId: string }> }
) {
  try {
    const session = await requireHostSession();
    const { eventTypeId } = await params;

    const eventType = await getEventTypeForHost(session.hostId, eventTypeId);
    return NextResponse.json({ eventType });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventTypeId: string }> }
) {
  try {
    const session = await requireHostSession();
    const { eventTypeId } = await params;
    const body = await request.json();

    const validated = EventTypeSchema.partial().parse(body);
    const eventType = await updateEventTypeForHost(
      session.hostId,
      eventTypeId,
      validated
    );
    return NextResponse.json({ eventType });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventTypeId: string }> }
) {
  try {
    const session = await requireHostSession();
    const { eventTypeId } = await params;

    const result = await deleteOrArchiveEventTypeForHost(
      session.hostId,
      eventTypeId
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


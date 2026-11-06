import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth/session";
import { DateOverrideSchema } from "@/lib/validations/date-override.schema";
import {
  updateDateOverrideForHost,
  deleteDateOverrideForHost,
} from "@/lib/services/date-override.service";
import { formatErrorResponse } from "@/lib/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ overrideId: string }> }
) {
  try {
    const session = await requireHostSession();
    const { overrideId } = await params;
    const body = await request.json();
    const validated = DateOverrideSchema.parse(body);

    const result = await updateDateOverrideForHost(
      session.hostId,
      overrideId,
      session.timezone,
      validated
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ overrideId: string }> }
) {
  try {
    const session = await requireHostSession();
    const { overrideId } = await params;

    const result = await deleteDateOverrideForHost(session.hostId, overrideId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


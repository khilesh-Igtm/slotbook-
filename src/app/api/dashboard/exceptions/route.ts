import { NextRequest, NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth/session";
import { DateOverrideSchema } from "@/lib/validations/date-override.schema";
import {
  listDateOverridesForHost,
  createDateOverrideForHost,
} from "@/lib/services/date-override.service";
import { formatErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireHostSession();
    const exceptions = await listDateOverridesForHost(session.hostId);
    return NextResponse.json({ exceptions });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireHostSession();
    const body = await request.json();
    const validated = DateOverrideSchema.parse(body);

    const result = await createDateOverrideForHost(
      session.hostId,
      session.timezone,
      validated
    );

    const status = result.requiresConfirmation ? 200 : 201;
    return NextResponse.json(result, { status });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


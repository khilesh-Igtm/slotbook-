import { NextRequest, NextResponse } from "next/server";
import { LoginSchema } from "@/lib/validations/auth.schema";
import { loginHost } from "@/lib/services/auth.service";
import { createHostSession } from "@/lib/auth/session";
import { formatErrorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedInput = LoginSchema.parse(body);

    const host = await loginHost(validatedInput);

    await createHostSession({
      hostId: host.id,
      email: host.email,
      name: host.name,
      slug: host.slug,
      timezone: host.timezone,
    });

    return NextResponse.json({
      success: true,
      host,
    });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


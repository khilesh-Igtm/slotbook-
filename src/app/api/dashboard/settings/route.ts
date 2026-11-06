import { NextRequest, NextResponse } from "next/server";
import { requireHostSession, createHostSession } from "@/lib/auth/session";
import { HostSettingsSchema } from "@/lib/validations/settings.schema";
import { prisma } from "@/lib/prisma";
import { formatErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireHostSession();
    const host = await prisma.host.findUnique({
      where: { id: session.hostId },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        timezone: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ host });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireHostSession();
    const body = await request.json();
    const validated = HostSettingsSchema.parse(body);

    const updatedHost = await prisma.host.update({
      where: { id: session.hostId },
      data: {
        name: validated.name,
        timezone: validated.timezone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        timezone: true,
      },
    });

    // Refresh active session cookie with updated name & timezone
    await createHostSession({
      hostId: updatedHost.id,
      email: updatedHost.email,
      name: updatedHost.name,
      slug: updatedHost.slug,
      timezone: updatedHost.timezone,
    });

    return NextResponse.json({
      success: true,
      message: "Host profile and timezone updated successfully.",
      host: updatedHost,
    });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatErrorResponse, NotFoundError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hostId: string }> }
) {
  try {
    const { hostId } = await params;

    const host = await prisma.host.findUnique({
      where: { id: hostId },
      include: {
        eventTypes: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!host) {
      throw new NotFoundError(`Host with id '${hostId}' not found.`);
    }

    return NextResponse.json({
      host: {
        id: host.id,
        name: host.name,
        email: host.email,
        timezone: host.timezone,
      },
      eventTypes: host.eventTypes,
    });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


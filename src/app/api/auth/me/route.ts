import { NextResponse } from "next/server";
import { getHostSession } from "@/lib/auth/session";
import { getAuthenticatedHost } from "@/lib/services/auth.service";
import { formatErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await getHostSession();
    if (!session || !session.hostId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated." } },
        { status: 401 }
      );
    }

    const host = await getAuthenticatedHost(session.hostId);
    return NextResponse.json({ host });
  } catch (error: unknown) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


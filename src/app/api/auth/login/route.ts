import { NextRequest, NextResponse } from "next/server";
import { LoginSchema } from "@/lib/validations/auth.schema";
import { loginHost } from "@/lib/services/auth.service";
import { createHostSession } from "@/lib/auth/session";
import { formatErrorResponse, UnauthorizedError } from "@/lib/errors";
import { loginRateLimiter, getClientIp } from "@/lib/auth/rate-limiter";

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  let rateLimitKey = `login:${clientIp}`;

  try {
    const body = await request.json();
    const validatedInput = LoginSchema.parse(body);

    rateLimitKey = `login:${clientIp}:${validatedInput.email.toLowerCase()}`;

    // 1. Check rate limit before authenticating
    const check = loginRateLimiter.check(rateLimitKey);
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: `Too many failed login attempts. Please try again in ${check.resetInSeconds} seconds.`,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(check.resetInSeconds),
          },
        }
      );
    }

    // 2. Perform authentication
    const host = await loginHost(validatedInput);

    // 3. Reset rate limit counter on success
    loginRateLimiter.reset(rateLimitKey);

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
    if (error instanceof UnauthorizedError) {
      // Record failure for rate limiting
      loginRateLimiter.recordFailure(rateLimitKey);
    }

    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}


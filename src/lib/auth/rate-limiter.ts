import { NextRequest } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private limits = new Map<string, RateLimitRecord>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;

    // Periodic cleanup of expired records every 5 minutes
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.limits.entries()) {
      if (now > record.resetAt) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Checks whether the given key has exceeded the allowed attempts.
   */
  check(key: string): { allowed: boolean; remaining: number; resetInSeconds: number } {
    const now = Date.now();
    const record = this.limits.get(key);

    if (!record || now > record.resetAt) {
      return {
        allowed: true,
        remaining: this.maxAttempts,
        resetInSeconds: Math.ceil(this.windowMs / 1000),
      };
    }

    const remaining = Math.max(0, this.maxAttempts - record.count);
    const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);

    return {
      allowed: record.count < this.maxAttempts,
      remaining,
      resetInSeconds,
    };
  }

  /**
   * Increments the attempt counter on failed authentication.
   */
  recordFailure(key: string): { allowed: boolean; remaining: number; resetInSeconds: number } {
    const now = Date.now();
    let record = this.limits.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + this.windowMs };
      this.limits.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, this.maxAttempts - record.count);
    const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);

    return {
      allowed: record.count <= this.maxAttempts,
      remaining,
      resetInSeconds,
    };
  }

  /**
   * Resets the attempt counter on successful authentication.
   */
  reset(key: string): void {
    this.limits.delete(key);
  }
}

// Global login rate limiter: 5 attempts per 15 minutes
export const loginRateLimiter = new InMemoryRateLimiter(5, 15 * 60 * 1000);

/**
 * Extracts client IP safely from Next.js request headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}


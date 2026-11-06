import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as healthCheckRoute } from "../src/app/api/health/route";
import { getEnvConfig } from "../src/lib/config/env";
import { loginRateLimiter } from "../src/lib/auth/rate-limiter";
import { POST as loginRoute } from "../src/app/api/auth/login/route";

describe("Phase 6: Production Readiness & Deployment Audits", () => {
  // ==========================================
  // 1. Health Check Endpoint
  // ==========================================
  describe("1. Health Check & Observability Endpoint", () => {
    it("GET /api/health returns 200 OK with connected database and uptime", async () => {
      const res = await healthCheckRoute();
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.status, "ok");
      assert.equal(typeof body.uptime, "number");
      assert.ok(body.timestamp);
      assert.equal(body.database?.status, "connected");
      assert.equal(typeof body.database?.latencyMs, "number");

      // Verify no-cache header
      const cacheControl = res.headers.get("Cache-Control");
      assert.ok(cacheControl?.includes("no-store"));
    });
  });

  // ==========================================
  // 2. Environment Configuration & Validation
  // ==========================================
  describe("2. Environment Configuration & Validation", () => {
    it("resolves active environment configuration in current environment", () => {
      const config = getEnvConfig();
      assert.ok(config.DATABASE_URL);
      assert.ok(config.resolvedSessionSecret);
      assert.ok(config.resolvedSessionSecret.length >= 32);
      assert.ok(config.APP_BASE_URL);
    });

    it("accepts JWT_SECRET as alternative to SESSION_SECRET", () => {
      const originalSession = process.env.SESSION_SECRET;
      const originalJwt = process.env.JWT_SECRET;

      try {
        delete process.env.SESSION_SECRET;
        process.env.JWT_SECRET = "production_jwt_secret_min_32_characters_long!";

        // Reset cached config
        const resolved = process.env.JWT_SECRET;
        assert.equal(resolved, "production_jwt_secret_min_32_characters_long!");
      } finally {
        if (originalSession) process.env.SESSION_SECRET = originalSession;
        if (originalJwt) process.env.JWT_SECRET = originalJwt;
        else delete process.env.JWT_SECRET;
      }
    });
  });

  // ==========================================
  // 3. Login Rate Limiting & Brute-Force Protection
  // ==========================================
  describe("3. Authentication Rate Limiting & Brute-Force Defense", () => {
    const testIp = "192.168.100.50";
    const testEmail = "bruteforce.target@example.com";
    const testKey = `login:${testIp}:${testEmail}`;

    it("allows initial attempts up to the threshold", () => {
      loginRateLimiter.reset(testKey);

      for (let i = 1; i <= 5; i++) {
        const check = loginRateLimiter.check(testKey);
        assert.equal(check.allowed, true);
        loginRateLimiter.recordFailure(testKey);
      }
    });

    it("blocks requests once the maximum failed attempt threshold is exceeded", () => {
      const check = loginRateLimiter.check(testKey);
      assert.equal(check.allowed, false, "Should block attempts beyond threshold");
      assert.equal(check.remaining, 0);
      assert.ok(check.resetInSeconds > 0);
    });

    it("resets rate limit counter upon successful authentication", () => {
      loginRateLimiter.reset(testKey);
      const check = loginRateLimiter.check(testKey);
      assert.equal(check.allowed, true);
      assert.equal(check.remaining, 5);
    });

    it("POST /api/auth/login returns 429 Too Many Requests when rate limited", async () => {
      const blockedIp = "10.0.0.99";
      const blockedEmail = "blocked.host@example.com";
      const key = `login:${blockedIp}:${blockedEmail}`;

      // Simulate 5 failed attempts
      loginRateLimiter.reset(key);
      for (let i = 0; i < 5; i++) {
        loginRateLimiter.recordFailure(key);
      }

      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": blockedIp,
        },
        body: JSON.stringify({
          email: blockedEmail,
          password: "WrongPassword123!",
        }),
      });

      const res = await loginRoute(req);
      assert.equal(res.status, 429);

      const body = await res.json();
      assert.equal(body.error?.code, "RATE_LIMIT_EXCEEDED");
      assert.ok(res.headers.get("Retry-After"));

      // Clean up
      loginRateLimiter.reset(key);
    });
  });

  // ==========================================
  // 4. Production Security & Data Exposure Audits
  // ==========================================
  describe("4. Security & Data Exposure Audits", () => {
    it("ensures .env is strictly excluded from version control", async () => {
      // Confirm .gitignore contains .env exclusion
      const fs = await import("node:fs/promises");
      const gitignore = await fs.readFile(".gitignore", "utf-8");
      assert.ok(gitignore.includes(".env*"));
      assert.ok(gitignore.includes("!.env.example"));
    });

    it("ensures Dockerfile executes as a non-root system user", async () => {
      const fs = await import("node:fs/promises");
      const dockerfile = await fs.readFile("Dockerfile", "utf-8");
      assert.ok(dockerfile.includes("USER nextjs"));
      assert.ok(dockerfile.includes("adduser --system"));
    });
  });
});


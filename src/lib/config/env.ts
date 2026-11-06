import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().url("APP_BASE_URL must be a valid URL").default("http://localhost:3000"),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Slotbook <notifications@slotbook.app>"),
  REMINDER_LEAD_HOURS: z.coerce.number().int().min(1).default(24),
  NOTIFICATION_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(5000),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  NOTIFICATION_LOCK_TIMEOUT_MS: z.coerce.number().int().min(10000).default(300000),
});

export type EnvConfig = z.infer<typeof envSchema> & {
  resolvedSessionSecret: string;
};

let cachedEnv: EnvConfig | null = null;

/**
 * Validates and returns the active environment configuration.
 * Throws a descriptive error at startup if required production variables are missing.
 */
export function getEnvConfig(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }

  const env = parsed.data;

  // Resolve session secret (support both SESSION_SECRET and JWT_SECRET)
  const resolvedSecret = env.SESSION_SECRET || env.JWT_SECRET;

  if (env.NODE_ENV === "production") {
    if (!resolvedSecret || resolvedSecret.length < 32) {
      throw new Error(
        "Production deployment error: SESSION_SECRET (or JWT_SECRET) must be set to a secure random string of at least 32 characters."
      );
    }

    if (resolvedSecret.includes("slotbook_default") || resolvedSecret.includes("your_secret")) {
      throw new Error(
        "Production deployment error: Insecure development secret detected. Please provide a production-generated secret."
      );
    }

    if (env.EMAIL_PROVIDER === "resend" && (!env.RESEND_API_KEY || !env.RESEND_API_KEY.startsWith("re_"))) {
      throw new Error(
        "Production deployment error: RESEND_API_KEY is required and must begin with 're_' when EMAIL_PROVIDER is set to 'resend'."
      );
    }
  }

  cachedEnv = {
    ...env,
    resolvedSessionSecret:
      resolvedSecret || "slotbook_default_session_secret_min_32_chars_2026!",
  };

  return cachedEnv;
}


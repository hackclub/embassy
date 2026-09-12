import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // NextAuth
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),
  AUTH_HCA_CLIENT_ID: z.string().min(1),
  AUTH_HCA_CLIENT_SECRET: z.string().min(1),

  // Superadmin bootstrap (optional, for initial setup only)
  SUPERADMIN_EMAILS: z.string().default(""),

  // Redis / Valkey (for feedback, rate limiting)
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),

  // PII encryption (for Hackatime tokens etc.) — AES-GCM key, base64, 16/24/32 bytes
  PII_ENCRYPTION_KEY: z
    .string()
    .default("")
    .superRefine((value, ctx) => {
      if (value === "") return;
      let bytes = 0;
      try {
        bytes = Buffer.from(value, "base64").length;
      } catch {
        bytes = 0;
      }
      if (![16, 24, 32].includes(bytes)) {
        ctx.addIssue({
          code: "custom",
          message: `PII_ENCRYPTION_KEY must decode to 16, 24, or 32 bytes (got ${bytes}).`,
        });
      }
    }),

  // Hackatime OAuth (optional — the link flow is disabled until both are set)
  AUTH_HACKATIME_CLIENT_ID: z.string().min(1).optional(),
  AUTH_HACKATIME_CLIENT_SECRET: z.string().min(1).optional(),

  // Email (provider interface)
  EMAIL_PROVIDER: z.enum(["mailpit", "loops"]).default("mailpit"),
  MAILPIT_URL: z.string().url().default("http://127.0.0.1:8025"),
  EMAIL_FROM: z.string().email().optional(),
  LOOPS_API_KEY: z.string().optional(),
  LOOPS_TX_RECIPIENT_FORM_ID: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // Airtable (one-way Postgres -> Airtable mirror)
  AIRTABLE_API_KEY: z.string().optional(),
  AIRTABLE_BASE_ID: z.string().optional(),

  // Feature flags
  FEATURE_EMAIL: z.string().default("false"),
  FEATURE_AIRTABLE: z.string().default("false"),
  FEATURE_RECIPIENT: z.string().default("true"),

  // Logging
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

  // Testing escape hatch — see lib/bypass.ts. Hard-rejected in production.
  ADMIN_BYPASS: z.string().optional(),
});

export interface EnvValidation {
  ok: boolean;
  issues: string[];
}

export function validateEnv(): EnvValidation {
  const parsed = envSchema.safeParse(process.env);
  const issues: string[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  }

  const isProduction = process.env.NODE_ENV === "production";
  const bypass = (process.env.ADMIN_BYPASS ?? "").trim().toLowerCase();
  if (isProduction && (bypass === "true" || bypass === "1" || bypass === "yes")) {
    issues.push("ADMIN_BYPASS is set but NODE_ENV=production — the auth bypass must never be enabled in production.");
  }

  const flagOn = (v: string | undefined) => (v ?? "").trim().toLowerCase() === "true";
  if (flagOn(process.env.FEATURE_AIRTABLE) && !(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID)) {
    issues.push("FEATURE_AIRTABLE=true but AIRTABLE_API_KEY/AIRTABLE_BASE_ID are missing.");
  }
  if (flagOn(process.env.FEATURE_EMAIL) && !(process.env.LOOPS_API_KEY || process.env.MAILPIT_URL)) {
    issues.push("FEATURE_EMAIL=true but no email provider is configured (LOOPS_API_KEY or MAILPIT_URL).");
  }

  return { ok: issues.length === 0, issues };
}

let validated = false;

/**
 * Called from instrumentation register(). In production a bad environment is
 * fatal (fail fast before serving traffic); elsewhere it warns loudly.
 */
export function assertEnv(): void {
  if (validated) return;
  validated = true;
  const { ok, issues } = validateEnv();
  if (ok) return;
  const message = `Invalid environment:\n- ${issues.join("\n- ")}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }
  console.warn(`[env] ${message}`);
}
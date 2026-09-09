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

  // Airtable
  AIRTABLE_API_KEY: z.string().optional(),
  AIRTABLE_BASE_ID: z.string().optional(),

  // Feature flags
  FEATURE_EMAIL: z.string().default("false"),
  FEATURE_AIRTABLE: z.string().default("false"),
  FEATURE_RECIPIENT: z.string().default("false"),

  // Logging
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export const env = envSchema.parse(process.env);
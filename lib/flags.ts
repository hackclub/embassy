// env-driven feature flags, see lib/env.ts

export function recipientDetailsEnabled(): boolean {
  const v = (process.env.FEATURE_RECIPIENT ?? "true").trim().toLowerCase();
  return v !== "false" && v !== "0";
}

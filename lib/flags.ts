// Feature flags read from env. Defaults match the deployed feature set —
// flip an env var (see lib/env.ts) to switch one off without a code change.

export function recipientDetailsEnabled(): boolean {
  // The recipient wizard is a core flow, so it ships on; set
  // FEATURE_RECIPIENT=false to close intake (tracking stays up).
  const v = (process.env.FEATURE_RECIPIENT ?? "true").trim().toLowerCase();
  return v !== "false" && v !== "0";
}

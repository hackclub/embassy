import { assertEnv } from "@/lib/env";

export async function register() {
  assertEnv();
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("@/lib/sentry");
    initSentry();
  }
}

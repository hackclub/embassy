import { assertEnv } from "@/lib/env";

export async function register() {
  assertEnv();
  // Sentry's node server SDK init; the browser bundle is set up in
  // instrumentation-client.ts. Skip non-node runtimes so the edge bundle
  // doesn't carry unused server SDK state.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("@/lib/sentry");
    initSentry();
  }
}

import { type NextRequest } from "next/server";
import { handlers } from "@/auth";
import { rateLimit, RATE_LIMITS, createRateLimitResponse } from "@/lib/rate-limit";

// /api/auth is public (programmatic clients must reach it) and the sign-in /
// OAuth-callback flow is the brute-force surface — so the limiter lives here.
const SIGNIN_FLOW = /\/api\/auth\/(signin|callback)/;

async function guard(req: NextRequest): Promise<Response | null> {
  if (!SIGNIN_FLOW.test(new URL(req.url).pathname)) return null;
  const rl = await rateLimit(req, RATE_LIMITS.auth);
  if (rl.allowed) return null;
  return createRateLimitResponse(rl, "Too many sign-in attempts — try again in a few minutes.");
}

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handlers.POST(req);
}

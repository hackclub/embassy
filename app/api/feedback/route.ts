import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { redis, getClientIdentifier } from "@/lib/redis";
import { rateLimit, RATE_LIMITS, createRateLimitResponse } from "@/lib/rate-limit";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { FEEDBACK_RETENTION_DAYS } from "@/lib/constants";
import { captureAPIError } from "@/lib/sentry";

const MAX_BODY_BYTES = 2_048;

const feedbackSchema = z.object({
  useful: z.boolean(),
  page: z
    .string()
    .trim()
    .max(200)
    .regex(/^\//, "page must be a path")
    .default("unknown"),
});

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, RATE_LIMITS.feedback);
    if (!rl.allowed) return createRateLimitResponse(rl);

    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
    }

    const identifier = getClientIdentifier(req);
    const key = `feedback:${identifier}`;

    // NX = atomic set-if-absent, so concurrent duplicates can't both win.
    const created = await redis.set(
      key,
      "1",
      "EX",
      FEEDBACK_RETENTION_DAYS * 60 * 60 * 24,
      "NX",
    );
    if (!created) {
      return NextResponse.json(
        { error: "Feedback already submitted" },
        { status: 409 }
      );
    }

    const entry = {
      useful: parsed.data.useful,
      page: parsed.data.page,
      timestamp: Date.now(),
    };

    await redis.lpush("feedback:all", JSON.stringify(entry));
    await redis.ltrim("feedback:all", 0, 999);

    return NextResponse.json({ success: true });
  } catch (e) {
    captureAPIError(e instanceof Error ? e : new Error(String(e)), {
      endpoint: "api/feedback",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const user = await getCurrentUserWithRole();
  if (!user || !hasRole(user.role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const entries = await redis.lrange("feedback:all", 0, 99);
    const parsed = entries
      .map((e) => {
        try {
          return JSON.parse(e as string);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Feedback fetch error:", e);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

import { redis, getClientIdentifier } from "./redis";
import logger from "./logger";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
  /** True when Redis was unreachable and the request was allowed anyway. */
  degraded?: boolean;
}

// Fail-open when Redis is down: a cache outage must not take the orders API
// and feedback endpoints offline for everyone. Abuse protection degrades to
// "none" for the duration, which is the lesser evil vs a full outage.
export async function rateLimit(
  req: Request,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(req);
  const key = `ratelimit:${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    const results = await redis
      .multi()
      .zremrangebyscore(key, 0, windowStart)
      .zadd(key, now, `${now}-${Math.random()}`)
      .zcard(key)
      .pexpire(key, config.windowMs)
      .exec();

    const current = (results?.[2]?.[1] as number) ?? 0;
    const allowed = current <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - current);
    const resetTime = now + config.windowMs;

    return { allowed, remaining, resetTime, totalRequests: current };
  } catch (e) {
    logger.error(
      { err: e instanceof Error ? e.message : String(e), keyPrefix: config.keyPrefix },
      "rate_limit_degraded_fail_open",
    );
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      totalRequests: 0,
      degraded: true,
    };
  }
}

export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.totalRequests + result.remaining),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
    "Retry-After": result.allowed ? "" : String(Math.ceil((result.resetTime - Date.now()) / 1000)),
  };
}

export function createRateLimitResponse(
  result: RateLimitResult,
  message = "Rate limit exceeded"
): Response {
  const headers = getRateLimitHeaders(result);
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export const RATE_LIMITS = {
  // One OAuth login consumes ~3 guarded requests (signin page, provider
  // callback) — 20/15min throttles brute force without locking out retries.
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 20, keyPrefix: "auth" },
  orders: { windowMs: 60 * 1000, maxRequests: 30, keyPrefix: "orders" },
  recipient: { windowMs: 60 * 1000, maxRequests: 20, keyPrefix: "recipient" },
  feedback: { windowMs: 60 * 60 * 1000, maxRequests: 5, keyPrefix: "feedback" },
} as const;
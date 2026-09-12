import Redis from "ioredis";

declare global {
  var __redis: Redis | undefined;
}

export const redis: Redis =
  globalThis.__redis ??
  new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });

if (process.env.NODE_ENV !== "production") globalThis.__redis = redis;

// Identifier used for rate limiting. Prefer the *rightmost* x-forwarded-for
// hop: a trusted fronting proxy (Caddy) appends the real peer address last,
// while any client-spoofed prefix sits earlier in the list. When traffic hits
// the node server directly the header is attacker-controlled and rate limits
// are best-effort only — run behind a proxy that overwrites XFF in production.
export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const hops = forwarded
    ? forwarded
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
    : [];
  const ip = (hops[hops.length - 1] ?? "unknown").slice(0, 64);
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 256);
  return `${ip}:${Buffer.from(ua).toString("base64").slice(0, 32)}`;
}

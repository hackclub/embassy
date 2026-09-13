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

// rightmost x-forwarded-for hop = the real client (appended by our fronting
// proxy); earlier ones are client-controllable, so only trust it behind Caddy
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

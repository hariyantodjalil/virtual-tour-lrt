import { NextRequest } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
};

declare global {
  var lrtApiRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const store = globalThis.lrtApiRateLimitStore ?? new Map<string, RateLimitEntry>();
globalThis.lrtApiRateLimitStore = store;

export function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (forwarded || realIp || "unknown").slice(0, 128);
}

export function consumeRateLimit(
  request: NextRequest,
  scope: string,
  options: { limit: number; windowMs: number; subject?: string }
): RateLimitResult {
  const now = Date.now();
  const identity = options.subject?.slice(0, 160) || getClientIdentifier(request);
  const key = `${scope}:${identity}`;
  const current = store.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current;

  entry.count += 1;
  store.set(key, entry);

  if (store.size > 10_000) {
    for (const [candidateKey, candidate] of store) {
      if (candidate.resetAt <= now) store.delete(candidateKey);
    }
  }

  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    allowed: entry.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - entry.count),
    resetAt: entry.resetAt,
    retryAfter,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfter) }),
  };
}

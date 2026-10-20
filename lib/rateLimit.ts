// ============================================================
// LOCATION: lib/rateLimit.ts
// Tiny in-memory sliding-window rate limiter (server only).
//
// Used by the public ordering endpoints (a single table / a single
// IP cannot spam orders) and by the auth endpoints (login attempts,
// OTP SMS requests, OTP guesses).
//
// NOTE: on Netlify (serverless) the instance is reused between
// warm calls but resets on a cold start — good enough to stop
// casual spam. For a hard limit put the app behind a CDN rule
// or move the counter into the DB (Tbl_TxnNumbers style).
// ============================================================

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Drop expired entries every N calls so the map cannot grow forever. */
let sweepCounter = 0;

function sweep(windowMs: number) {
  sweepCounter += 1;
  if (sweepCounter % 50 !== 0) return;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Register a hit for `key` and tell whether it is allowed.
 *   limit    — max hits inside the window
 *   windowMs — window length in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.hits.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Check a bucket WITHOUT registering a hit.
 * Used for failure counters — only failed attempts should count,
 * so the caller registers the hit itself (registerHit) on failure.
 */
export function tooMany(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(windowMs);
  const bucket = buckets.get(key);
  const hits = (bucket?.hits ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }
  return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

/** Register a hit without checking the limit (see `tooMany`). */
export function registerHit(key: string, windowMs: number): void {
  sweep(windowMs);
  const bucket = buckets.get(key) ?? { hits: [] };
  const now = Date.now();
  bucket.hits = [...bucket.hits.filter((t) => now - t < windowMs), now];
  buckets.set(key, bucket);
}

/** Clear a bucket — e.g. failed-login counter after a successful login. */
export function resetKey(key: string): void {
  buckets.delete(key);
}

/** Best-effort client IP from the request headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

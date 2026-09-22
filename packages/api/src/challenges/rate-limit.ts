import { challengeError } from "./errors";

/**
 * Tiny fixed-window limiter for the public invitation + join endpoints. The
 * API is a single instance and the group is small, so in-memory is enough.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Throws 429 once `key` exceeds the limit inside the window. */
  hit(key: string, now = Date.now()) {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return;
    }
    entry.count++;
    if (entry.count > this.limit) throw challengeError(429, "rate_limited");
  }

  private sweep(now: number) {
    if (this.hits.size < 5_000) return;
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

/** Client key: first X-Forwarded-For hop (the web rewrite forwards it), else socket IP. */
export function clientKey(req: { headers: Record<string, unknown>; ip?: string }): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = typeof fwd === "string" ? fwd.split(",")[0].trim() : "";
  return first || req.ip || "unknown";
}

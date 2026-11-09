// In-memory limiters (fine for a single dev/demo server; use Redis/Upstash on serverless).

/** At most `limit` hits per `windowMs` per key (sliding window). */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}

  check(key: string, now = Date.now()): { ok: boolean; retryAfterMs: number } {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterMs: this.windowMs - (now - recent[0]) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.prune(now);
    return { ok: true, retryAfterMs: 0 };
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
  }
}

/** Lets one call through per key every `intervalMs`; everyone else should use the cached value. */
export class MinIntervalGate {
  private last = new Map<string, number>();
  constructor(private readonly intervalMs: number) {}

  tryEnter(key: string, now = Date.now()): boolean {
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev < this.intervalMs) return false;
    this.last.set(key, now);
    if (this.last.size > 5000) for (const [k, t] of this.last) if (now - t >= this.intervalMs) this.last.delete(k);
    return true;
  }
}

// Keep instances across Next dev hot reloads.
const g = globalThis as unknown as { __rl?: Map<string, unknown> };
function shared<T>(name: string, make: () => T): T {
  const m = (g.__rl ??= new Map());
  if (!m.has(name)) m.set(name, make());
  return m.get(name) as T;
}

export const paymentCreateLimiter = () => shared("payment-create", () => new SlidingWindowLimiter(10, 60_000));
export const paymentPreviewLimiter = () => shared("payment-preview", () => new SlidingWindowLimiter(30, 60_000));
export const auroraStatusGate = () => shared("aurora-status", () => new MinIntervalGate(3000));

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

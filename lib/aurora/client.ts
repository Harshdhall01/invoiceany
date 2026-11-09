// SERVER-ONLY thin wrapper around the Aurora Intents Swap API.
// The API key is part of the URL path (per the docs), so every message
// and error produced here has the key redacted.
import type { AuroraConfig } from "./config";
import type { AuroraToken, QuoteParams, QuoteResponse, StatusResponse } from "./types";

export class AuroraNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuroraNetworkError";
  }
}

export class AuroraApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "AuroraApiError";
    this.status = status;
    this.body = body;
  }
}

type ClientConfig = Pick<AuroraConfig, "AURORA_API_KEY" | "AURORA_BASE_URL">;

const TIMEOUT_MS = 10_000;

export class AuroraClient {
  constructor(private readonly cfg: ClientConfig) {}

  private redact(text: string): string {
    return this.cfg.AURORA_API_KEY ? text.split(this.cfg.AURORA_API_KEY).join("***") : text;
  }

  private redactDeep(value: unknown): unknown {
    try {
      return JSON.parse(this.redact(JSON.stringify(value)));
    } catch {
      return value;
    }
  }

  private async request<T>(method: "GET" | "POST", endpoint: string, opts: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
    const key = encodeURIComponent(this.cfg.AURORA_API_KEY);
    const qs = opts.query ? `?${new URLSearchParams(opts.query).toString()}` : "";
    const url = `${this.cfg.AURORA_BASE_URL.replace(/\/$/, "")}/api/${endpoint}/${key}${qs}`;
    const label = `${method} /api/${endpoint}/***`;

    let res: Response | undefined;
    let lastErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(url, {
          method,
          headers: opts.body ? { "Content-Type": "application/json" } : undefined,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
        break;
      } catch (err) {
        lastErr = this.redact(err instanceof Error ? err.message : String(err));
      }
    }
    if (!res) throw new AuroraNetworkError(`${label} failed after retry: ${lastErr}`);

    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw text */
    }

    if (!res.ok) {
      const msg =
        body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
          ? (body as { message: string }).message
          : text.slice(0, 200);
      throw new AuroraApiError(`${label} failed (${res.status}): ${this.redact(msg)}`, res.status, this.redactDeep(body));
    }
    return body as T;
  }

  /**
   * The docs show two shapes: a plain array (quickstart) and
   * { asset_stats, tokens } (API reference). Accept both and report which we got.
   */
  async getTokens(): Promise<{ tokens: AuroraToken[]; shape: "array" | "object" }> {
    const json = await this.request<unknown>("GET", "tokens");
    if (Array.isArray(json)) return { tokens: json as AuroraToken[], shape: "array" };
    if (json && typeof json === "object" && Array.isArray((json as { tokens?: unknown }).tokens)) {
      return { tokens: (json as { tokens: AuroraToken[] }).tokens, shape: "object" };
    }
    throw new AuroraApiError("GET /api/tokens/*** returned an unexpected response shape", 200, this.redactDeep(json));
  }

  requestQuote(params: QuoteParams): Promise<QuoteResponse> {
    return this.request<QuoteResponse>("POST", "quote", { body: params });
  }

  getStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse> {
    const query: Record<string, string> = { depositAddress };
    if (depositMemo) query.depositMemo = depositMemo;
    return this.request<StatusResponse>("GET", "status", { query });
  }
}

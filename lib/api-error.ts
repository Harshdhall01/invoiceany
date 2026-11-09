// Consistent JSON errors for every route: { error: { code, message } }.
// Aurora errors are mapped to friendly messages; internals never reach the client.
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuroraApiError, AuroraNetworkError } from "./aurora/client";
import { AuroraConfigError } from "./aurora/config";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly headers?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface MappedError {
  status: number;
  code: string;
  message: string;
  headers?: Record<string, string>;
}

export function mapError(err: unknown): MappedError {
  if (err instanceof ApiError) return { status: err.status, code: err.code, message: err.message, headers: err.headers };
  if (err instanceof ZodError) {
    const i = err.issues[0];
    const where = i?.path.length ? `${i.path.join(".")}: ` : "";
    return { status: 400, code: "INVALID_REQUEST", message: `${where}${i?.message ?? "Invalid request"}` };
  }
  if (err instanceof AuroraConfigError) {
    return { status: 503, code: "PAYMENTS_NOT_CONFIGURED", message: "Payments are not configured on the server yet." };
  }
  if (err instanceof AuroraNetworkError) {
    return { status: 504, code: "PROVIDER_UNREACHABLE", message: "We could not reach the payment provider. Please try again in a moment." };
  }
  if (err instanceof AuroraApiError) {
    if (err.status === 400 || err.status === 422)
      return {
        status: 422,
        code: "PROVIDER_REJECTED",
        message: "The payment provider rejected this request. Check the refund address and the selected asset, then try again.",
      };
    if (err.status === 429)
      return { status: 503, code: "PROVIDER_BUSY", message: "The payment provider is busy. Please try again in a few seconds." };
    if (err.status === 401 || err.status === 403)
      return { status: 503, code: "PAYMENTS_NOT_CONFIGURED", message: "Payments are not configured on the server yet." };
    return { status: 502, code: "PROVIDER_ERROR", message: "The payment provider had a problem. Please try again shortly." };
  }
  return { status: 500, code: "INTERNAL", message: "Something went wrong on our side." };
}

export function errorResponse(err: unknown): NextResponse {
  const m = mapError(err);
  if (m.status >= 500) {
    // Aurora errors are already key-redacted by the client; log name + message only.
    console.error(`[api] ${m.code}:`, err instanceof Error ? `${err.name}: ${err.message}` : "non-error thrown");
  }
  return NextResponse.json({ error: { code: m.code, message: m.message } }, { status: m.status, headers: m.headers });
}

export const bad = (code: string, message: string, status = 400) => new ApiError(code, message, status);

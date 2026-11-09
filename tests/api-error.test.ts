import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ApiError, errorResponse, mapError } from "@/lib/api-error";
import { AuroraApiError, AuroraNetworkError } from "@/lib/aurora/client";
import { AuroraConfigError } from "@/lib/aurora/config";

test("Aurora 400 -> 422 PROVIDER_REJECTED, internals not leaked", () => {
  const m = mapError(new AuroraApiError("POST /api/quote/*** failed (400): recipient is not valid", 400, { correlationId: "x" }));
  assert.equal(m.status, 422);
  assert.equal(m.code, "PROVIDER_REJECTED");
  assert.doesNotMatch(m.message, /recipient|correlationId|\*\*\*/);
});

test("Aurora 429 / 5xx / auth / network / config map to friendly codes", () => {
  assert.equal(mapError(new AuroraApiError("x", 429, null)).code, "PROVIDER_BUSY");
  assert.equal(mapError(new AuroraApiError("x", 500, null)).code, "PROVIDER_ERROR");
  assert.equal(mapError(new AuroraApiError("x", 401, null)).code, "PAYMENTS_NOT_CONFIGURED");
  assert.equal(mapError(new AuroraNetworkError("boom")).code, "PROVIDER_UNREACHABLE");
  assert.equal(mapError(new AuroraConfigError("AURORA_API_KEY missing")).code, "PAYMENTS_NOT_CONFIGURED");
});

test("zod errors -> 400 INVALID_REQUEST with the field name", () => {
  const r = z.object({ a: z.string() }).safeParse({});
  const m = mapError((r as { error: z.ZodError }).error);
  assert.equal(m.status, 400);
  assert.equal(m.code, "INVALID_REQUEST");
  assert.match(m.message, /^a: /);
});

test("unknown errors -> generic 500, original message hidden", async () => {
  const origErr = console.error;
  console.error = () => {};
  try {
    const res = errorResponse(new Error("db password is hunter2"));
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.equal(body.error.code, "INTERNAL");
    assert.doesNotMatch(JSON.stringify(body), /hunter2/);
  } finally {
    console.error = origErr;
  }
});

test("ApiError keeps status, code and headers", async () => {
  const res = errorResponse(new ApiError("RATE_LIMITED", "slow down", 429, { "Retry-After": "7" }));
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "7");
  assert.deepEqual(await res.json(), { error: { code: "RATE_LIMITED", message: "slow down" } });
});

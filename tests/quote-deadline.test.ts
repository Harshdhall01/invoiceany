import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveDeadline } from "../lib/aurora/quote";
import type { QuoteResponse } from "../lib/aurora/types";

const OURS = "2026-11-08T11:51:15.619Z";
const INACTIVE = "2026-11-11T11:51:15.619Z"; // what the real API returned: +72h
const resp = (echo: unknown): QuoteResponse =>
  ({ timestamp: "t", signature: "s", quoteRequest: { deadline: echo }, quote: { deadline: INACTIVE, timeWhenInactive: INACTIVE } }) as unknown as QuoteResponse;

test("uses the deadline we requested (echoed by Aurora), not the +72h address-inactive time", () => {
  assert.equal(effectiveDeadline(resp(OURS), "2099-01-01T00:00:00Z"), OURS);
});

test("falls back to our own requested deadline when the echo is missing or invalid", () => {
  assert.equal(effectiveDeadline(resp(undefined), OURS), OURS);
  assert.equal(effectiveDeadline(resp("not-a-date"), OURS), OURS);
  assert.equal(effectiveDeadline({ quote: {} } as unknown as QuoteResponse, OURS), OURS);
});

// Run: npx tsx --test lib/aurora/status.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapAuroraStatus } from "./status";
import { usdToBaseUnits } from "./amounts";
import type { SwapDetails } from "./types";

const now = new Date("2026-11-08T12:00:00Z");
const future = "2026-11-08T13:00:00Z";
const past = "2026-11-08T11:00:00Z";
const base = { invoiceAmountUsd: 10, now, quoteDeadline: future };
const details = (o: Partial<SwapDetails> = {}): SwapDetails => ({
  intentHashes: [],
  nearTxHashes: [],
  originChainTxHashes: [],
  destinationChainTxHashes: [],
  ...o,
});

test("PENDING_DEPOSIT before deadline -> Pending", () => {
  const m = mapAuroraStatus({ ...base, rawStatus: "PENDING_DEPOSIT" });
  assert.equal(m.status, "Pending");
  assert.equal(m.known, true);
});

test("PENDING_DEPOSIT after deadline -> Expired", () => {
  assert.equal(mapAuroraStatus({ ...base, quoteDeadline: past, rawStatus: "PENDING_DEPOSIT" }).status, "Expired");
});

test("KNOWN_DEPOSIT_TX -> Pending (Deposit detected)", () => {
  const m = mapAuroraStatus({ ...base, rawStatus: "KNOWN_DEPOSIT_TX" });
  assert.equal(m.status, "Pending");
  assert.equal(m.label, "Deposit detected");
});

test("PROCESSING -> Pending (Swapping)", () => {
  const m = mapAuroraStatus({ ...base, rawStatus: "PROCESSING" });
  assert.equal(m.status, "Pending");
  assert.equal(m.label, "Swapping");
});

test("SUCCESS -> Paid with received amount from swap details", () => {
  const m = mapAuroraStatus({ ...base, rawStatus: "SUCCESS", swapDetails: details({ amountOutFormatted: "10.0" }) });
  assert.equal(m.status, "Paid");
  assert.equal(m.receivedAmount, 10);
});

test("SUCCESS without details falls back to invoice amount", () => {
  const m = mapAuroraStatus({ ...base, rawStatus: "SUCCESS" });
  assert.equal(m.status, "Paid");
  assert.equal(m.receivedAmount, 10);
});

test("SUCCESS with refundedAmount > 0 -> Overpaid", () => {
  const m = mapAuroraStatus({
    ...base,
    rawStatus: "SUCCESS",
    swapDetails: details({ amountOutFormatted: "10.0", refundedAmount: "250000" }),
  });
  assert.equal(m.status, "Overpaid");
});

test("INCOMPLETE_DEPOSIT -> Underpaid", () => {
  assert.equal(mapAuroraStatus({ ...base, rawStatus: "INCOMPLETE_DEPOSIT" }).status, "Underpaid");
});

test("REFUNDED -> Refunded", () => {
  assert.equal(mapAuroraStatus({ ...base, rawStatus: "REFUNDED" }).status, "Refunded");
});

test("FAILED -> Failed", () => {
  assert.equal(mapAuroraStatus({ ...base, rawStatus: "FAILED" }).status, "Failed");
});

test("unknown status does not crash, maps to Pending", () => {
  const m = mapAuroraStatus({ ...base, rawStatus: "SOMETHING_NEW" });
  assert.equal(m.status, "Pending");
  assert.equal(m.known, false);
});

test("usdToBaseUnits", () => {
  assert.equal(usdToBaseUnits(10, 6), "10000000");
  assert.equal(usdToBaseUnits(12.34, 6), "12340000");
  assert.equal(usdToBaseUnits(0.01, 6), "10000");
  assert.throws(() => usdToBaseUnits(0, 6));
  assert.throws(() => usdToBaseUnits(5, 1));
});

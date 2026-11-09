import "./setup";
process.env.PAYMENT_PROVIDER = "aurora"; // enables throttling logic; provider itself is faked
import test from "node:test";
import assert from "node:assert/strict";
import { __setProviderForTests } from "@/lib/provider";
import { refreshInvoice } from "@/lib/invoices";
import { fakeProvider, makeInvoice, GOOD_REFUND } from "./helpers";

const aurora = (state?: string) => ({
  originAssetId: "a", originChain: "base", originSymbol: "USDC", refundAddress: GOOD_REFUND,
  deadline: "2999-01-01T00:00:00Z", amountIn: "1", amountInFormatted: "1", minAmountIn: "1", state,
});

test("at most one Aurora status call per invoice per 3 seconds; force bypasses the cache", async () => {
  const f = fakeProvider();
  __setProviderForTests(f.provider);
  const inv = await makeInvoice({ depositAddress: "0xDEP", aurora: aurora("PENDING_DEPOSIT") });
  await refreshInvoice(inv);
  await refreshInvoice(inv);
  await refreshInvoice(inv);
  assert.equal(f.calls.status, 1);
  await refreshInvoice(inv, { force: true });
  assert.equal(f.calls.status, 2);
});

test("finished swaps (SUCCESS / REFUNDED) never hit Aurora again", async () => {
  const f = fakeProvider();
  __setProviderForTests(f.provider);
  for (const state of ["SUCCESS", "REFUNDED"]) {
    const inv = await makeInvoice({ depositAddress: "0xDEP", aurora: aurora(state) });
    await refreshInvoice(inv, { force: true });
  }
  assert.equal(f.calls.status, 0);
});

test("invoices without a quote yet do not count against the gate", async () => {
  const f = fakeProvider();
  __setProviderForTests(f.provider);
  const inv = await makeInvoice();
  await refreshInvoice(inv);
  await refreshInvoice(inv);
  assert.equal(f.calls.status, 2); // provider decides (it makes no network call without a quote)
});

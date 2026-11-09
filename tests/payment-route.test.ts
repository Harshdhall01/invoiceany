import "./setup";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getInvoice } from "@/lib/db";
import { __setProviderForTests } from "@/lib/provider";
import { AuroraApiError } from "@/lib/aurora/client";
import { POST as createPayment } from "@/app/api/invoices/[id]/payment/route";
import { POST as previewPayment } from "@/app/api/invoices/[id]/quote-preview/route";
import { BASE_USDC, GOOD_REFUND, fakeProvider, freshIp, makeInvoice, post } from "./helpers";

const body = { originAssetId: BASE_USDC.assetId, refundAddress: GOOD_REFUND };
const pay = (id: string, b: unknown = body, ip?: string, raw = false) =>
  createPayment(post(`/api/invoices/${id}/payment`, b, ip, raw), { params: { id } });

let fake = fakeProvider();
beforeEach(() => {
  fake = fakeProvider();
  __setProviderForTests(fake.provider);
});

test("validation: bad JSON, missing fields, unknown asset, bad refund address, unknown invoice", async () => {
  const inv = await makeInvoice();
  const errs = [console.error]; console.error = () => {};

  let r = await pay(inv.id, "{nope", undefined, true);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, "INVALID_JSON");

  r = await pay(inv.id, { originAssetId: BASE_USDC.assetId });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.equal(j.error.code, "INVALID_REQUEST");
  assert.match(j.error.message, /refundAddress/);

  r = await pay(inv.id, { originAssetId: "nep141:nope", refundAddress: GOOD_REFUND });
  assert.equal((await r.json()).error.code, "UNSUPPORTED_ASSET");

  r = await pay(inv.id, { originAssetId: BASE_USDC.assetId, refundAddress: "0x123" });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, "INVALID_REFUND_ADDRESS");

  r = await pay("does-not-exist");
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error.code, "NOT_FOUND");

  assert.equal(fake.calls.create, 0, "no quote may be created for invalid requests");
  console.error = errs[0];
});

test("success: persists quote fields; response hides rawQuote and the full refund address", async () => {
  const inv = await makeInvoice();
  const r = await pay(inv.id);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.reused, false);
  assert.equal(j.invoice.depositAddress, "0xDEPOSIT1");
  assert.equal(j.invoice.aurora.amountInFormatted, "10.34");
  const text = JSON.stringify(j);
  assert.doesNotMatch(text, /SECRET-SIGNATURE|rawQuote|corr-1/);
  assert.doesNotMatch(text, new RegExp(GOOD_REFUND));

  const stored = await getInvoice(inv.id);
  assert.equal(stored?.depositAddress, "0xDEPOSIT1");
  assert.equal(stored?.aurora?.refundAddress, GOOD_REFUND);
  assert.ok(stored?.aurora?.rawQuote, "raw quote persisted for debugging");
});

test("idempotent: second call returns the same quote, provider called once", async () => {
  const inv = await makeInvoice();
  await pay(inv.id);
  const r = await pay(inv.id);
  const j = await r.json();
  assert.equal(j.reused, true);
  assert.equal(j.invoice.depositAddress, "0xDEPOSIT1");
  assert.equal(fake.calls.create, 1);
});

test("idempotent under concurrency: 5 simultaneous requests create exactly one quote", async () => {
  fake = fakeProvider({ delayMs: 30 });
  __setProviderForTests(fake.provider);
  const inv = await makeInvoice();
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => pay(inv.id)));
  const js = await Promise.all(rs.map((r) => r.json()));
  assert.equal(fake.calls.create, 1);
  assert.equal(new Set(js.map((j) => j.invoice.depositAddress)).size, 1);
  assert.equal(js.filter((j) => j.reused === false).length, 1);
});

test("never creates a quote for a Paid, Overpaid or Refunded invoice", async () => {
  for (const status of ["Paid", "Overpaid", "Refunded"] as const) {
    const inv = await makeInvoice({ status, depositAddress: "0xOLD", aurora: undefined });
    const r = await pay(inv.id);
    assert.equal(r.status, 409, status);
    assert.equal((await r.json()).error.code, "INVOICE_SETTLED");
  }
  assert.equal(fake.calls.create, 0);
});

test("Failed and Expired quotes are replaced; the old address is kept in quoteHistory", async () => {
  for (const status of ["Failed", "Expired"] as const) {
    const inv = await makeInvoice();
    await pay(inv.id); // quote #n
    const first = (await getInvoice(inv.id))!;
    const { updateInvoice } = await import("@/lib/db");
    await updateInvoice(inv.id, { status });
    const r = await pay(inv.id);
    const j = await r.json();
    assert.equal(j.reused, false, status);
    assert.notEqual(j.invoice.depositAddress, first.depositAddress);
    const stored = (await getInvoice(inv.id))!;
    assert.equal(stored.status, "Pending");
    assert.equal(stored.quoteHistory?.[0].depositAddress, first.depositAddress);
  }
});

test("Underpaid with a pending refund is NOT replaced (old address must stay tracked)", async () => {
  const inv = await makeInvoice();
  await pay(inv.id);
  const { updateInvoice } = await import("@/lib/db");
  await updateInvoice(inv.id, { status: "Underpaid" });
  const j = await (await pay(inv.id)).json();
  assert.equal(j.reused, true);
  assert.equal(fake.calls.create, 1);
});

test("overdue invoice without a live quote is rejected", async () => {
  const inv = await makeInvoice({ dueDate: "2000-01-01" });
  const r = await pay(inv.id);
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error.code, "INVOICE_EXPIRED");
  assert.equal(fake.calls.create, 0);
});

test("money values come from the stored invoice, never from the request", async () => {
  const inv = await makeInvoice({ amountUsd: 42 });
  await pay(inv.id, { ...body, amountUsd: 0.01, amount: "1", recipient: "attacker", destinationAsset: "x" });
  assert.equal(fake.calls.lastInvoiceAmount, 42);
});

test("Aurora errors are mapped to friendly JSON without leaking internals", async () => {
  fake = fakeProvider({ failWith: new AuroraApiError("POST /api/quote/*** failed (400): recipient is not valid", 400, { correlationId: "leak-me" }) });
  __setProviderForTests(fake.provider);
  const inv = await makeInvoice();
  const r = await pay(inv.id);
  assert.equal(r.status, 422);
  const j = await r.json();
  assert.equal(j.error.code, "PROVIDER_REJECTED");
  assert.doesNotMatch(JSON.stringify(j), /leak-me|recipient is not valid/);
  assert.equal((await getInvoice(inv.id))?.depositAddress, "", "nothing persisted on failure");
});

test("per-IP limit: 11th request in a minute gets 429 + Retry-After", async () => {
  const inv = await makeInvoice();
  const ip = freshIp();
  let last!: Response;
  for (let i = 0; i < 11; i++) last = await pay(inv.id, body, ip);
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get("Retry-After")) > 0);
  assert.equal((await last.json()).error.code, "RATE_LIMITED");
  assert.equal((await pay(inv.id, body, freshIp())).status, 200, "other IPs unaffected");
});

test("quote-preview: returns estimate, validates, and creates nothing", async () => {
  const inv = await makeInvoice();
  const prev = (b: unknown) => previewPayment(post(`/api/invoices/${inv.id}/quote-preview`, b), { params: { id: inv.id } });

  const ok = await prev(body);
  assert.equal(ok.status, 200);
  const j = await ok.json();
  assert.equal(j.preview.amountInFormatted, "10.340000");
  assert.equal(j.preview.feeUsd, 0.34);
  assert.equal(j.refundAddressCheck.verified, true);

  const bad = await prev({ ...body, refundAddress: "0xabc" });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, "INVALID_REFUND_ADDRESS");

  assert.equal(fake.calls.create, 0);
  assert.equal((await getInvoice(inv.id))?.depositAddress, "");
});

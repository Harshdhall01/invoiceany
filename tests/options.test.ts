import test from "node:test";
import assert from "node:assert/strict";
import { buildPaymentOptions } from "@/lib/aurora/options";
import type { AuroraToken } from "@/lib/aurora/types";

const t = (assetId: string, blockchain: string, symbol: string, decimals = 6): AuroraToken =>
  ({ assetId, blockchain, symbol, decimals, price: 1, priceUpdatedAt: "" });

test("only offers curated chain/symbol combos that exist in the real tokens list", () => {
  const tokens = [
    t("base-usdc", "base", "USDC"), t("base-eth", "base", "ETH", 18), t("eth-usdc", "eth", "USDC"),
    t("sol-usdc", "sol", "USDC"), t("doge", "doge", "DOGE", 8), t("arb-usdt", "arb", "USDT"),
  ];
  const opts = buildPaymentOptions(tokens, "sol-usdc");
  assert.deepEqual(opts.map((o) => `${o.symbol}@${o.chain}`), ["USDC@base", "ETH@base", "USDC@eth"]);
  assert.equal(opts[1].decimals, 18);
});

test("never offers the destination asset as an origin", () => {
  const opts = buildPaymentOptions([t("base-usdc", "base", "USDC")], "base-usdc");
  assert.equal(opts.length, 0);
});

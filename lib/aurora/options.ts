import type { PaymentOption } from "../types";
import type { AuroraToken } from "./types";

/** Chains and symbols we offer. An option only appears if it really exists in Aurora's tokens response. */
export const CURATED_CHAINS: { slug: string; label: string }[] = [
  { slug: "base", label: "Base" },
  { slug: "eth", label: "Ethereum" },
  { slug: "arb", label: "Arbitrum" },
  { slug: "op", label: "Optimism" },
  { slug: "pol", label: "Polygon" },
];
export const CURATED_SYMBOLS = ["USDC", "ETH"];

export function buildPaymentOptions(tokens: AuroraToken[], destinationAssetId: string): PaymentOption[] {
  const out: PaymentOption[] = [];
  for (const chain of CURATED_CHAINS) {
    for (const symbol of CURATED_SYMBOLS) {
      const t = tokens.find(
        (x) => x.blockchain === chain.slug && x.symbol?.toUpperCase() === symbol && x.assetId !== destinationAssetId
      );
      if (t) out.push({ assetId: t.assetId, chain: chain.slug, chainLabel: chain.label, symbol, decimals: t.decimals });
    }
  }
  return out;
}

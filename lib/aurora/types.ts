// Types mirror the official Aurora Intents API reference
// (https://docs.intents.aurora.dev/api-reference/swap-api-reference).
// Only fields we use are listed.

export type AuroraStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "PROCESSING"
  | "SUCCESS"
  | "INCOMPLETE_DEPOSIT"
  | "REFUNDED"
  | "FAILED";

export const KNOWN_STATUSES: readonly AuroraStatus[] = [
  "PENDING_DEPOSIT",
  "KNOWN_DEPOSIT_TX",
  "PROCESSING",
  "SUCCESS",
  "INCOMPLETE_DEPOSIT",
  "REFUNDED",
  "FAILED",
];

export function isKnownStatus(s: string): s is AuroraStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(s);
}

export interface AuroraToken {
  assetId: string;
  decimals: number;
  blockchain: string; // chain slug, e.g. "near", "eth", "base", "sol"
  symbol: string;
  price: number; // USD
  priceUpdatedAt: string;
  contractAddress?: string | null;
}

export type SwapType = "EXACT_INPUT" | "EXACT_OUTPUT";

export interface QuoteParams {
  dry: boolean;
  swapType: SwapType;
  depositType: "ORIGIN_CHAIN";
  originAsset: string;
  destinationAsset: string;
  amount: string; // smallest unit; input or output depending on swapType
  slippageTolerance: number; // basis points
  refundTo: string; // address on the origin chain
  refundType: "ORIGIN_CHAIN";
  recipient: string; // Solana address
  recipientType: "DESTINATION_CHAIN";
  deadline?: string; // ISO timestamp
}

export interface QuoteDetails {
  timeEstimate: number;
  deadline?: string;
  timeWhenInactive?: string;
  depositAddress?: string; // absent when dry=true
  depositMemo?: string; // only for memo-based chains
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string;
  minAmountIn: string;
  maxAmountIn?: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  minAmountOut: string;
  // Returned by the live API (seen in our dry run); not in every doc example, so optional.
  refundFee?: string;
  withdrawFee?: string;
}

export interface QuoteResponse {
  timestamp: string;
  signature: string;
  correlationId?: string | null;
  quoteRequest: Record<string, unknown>;
  quote: QuoteDetails;
}

export interface ChainTx {
  hash: string;
  explorerUrl: string;
}

export interface SwapDetails {
  intentHashes: string[];
  nearTxHashes: string[];
  amountIn?: string | null;
  amountInFormatted?: string | null;
  amountOut?: string | null;
  amountOutFormatted?: string | null;
  originChainTxHashes: ChainTx[];
  destinationChainTxHashes: ChainTx[];
  refundedAmount?: string | null;
  refundedAmountFormatted?: string | null;
  refundReason?: string | null;
  depositedAmount?: string | null;
  depositedAmountFormatted?: string | null;
  depositedAmountUsd?: string | null;
}

export interface StatusResponse {
  // Typed as string on purpose: unknown values must not crash us (mapped in Step C).
  status: string;
  correlationId?: string;
  updatedAt?: string;
  quoteResponse?: QuoteResponse;
  swapDetails?: SwapDetails; // absent for confidential swaps (we don't use those)
}

export type InvoiceStatus =
  | "Pending"
  | "Paid"
  | "Underpaid"
  | "Overpaid"
  | "Expired"
  | "Refunded"
  | "Failed";

/** Data we keep per invoice when PAYMENT_PROVIDER=aurora. */
export interface AuroraInvoiceData {
  originAssetId: string;
  originChain: string;
  originSymbol: string;
  refundAddress: string; // client's address on the origin chain
  depositMemo?: string; // only for memo-based chains
  deadline: string; // ISO: payment deadline we requested; Aurora starts refunds after it
  quotedAt?: string; // ISO: when the quote / deposit address was created
  inactiveAt?: string; // ISO: when Aurora deactivates the deposit address (observed: requested deadline + 72h)
  correlationId?: string | null;
  amountIn: string; // smallest unit, what the client should send
  amountInFormatted: string; // human readable
  minAmountIn: string;
  maxAmountIn?: string;
  chainLabel?: string; // e.g. "Base"
  amountInUsd?: string; // USD value of what the client sends
  amountOutUsd?: string; // USD value the freelancer receives
  feeUsd?: number; // amountInUsd - amountOutUsd (fees + slippage cushion), derived
  timeEstimate?: number; // seconds, as estimated by Aurora
  withdrawFee?: string; // raw, as returned by Aurora (units not documented, display-only if at all)
  refundFee?: string; // raw, as returned by Aurora
  state?: string; // last raw Aurora status
  label?: string; // friendly sub-label, e.g. "Swapping"
  depositedFormatted?: string;
  refundedFormatted?: string;
  refundReason?: string;
  payoutTx?: { hash: string; explorerUrl: string }; // Solana payout tx to the freelancer
  rawQuote?: unknown; // for debugging
}

/** A payment option the client can choose (provider-neutral). */
export interface PaymentOption {
  assetId: string;
  chain: string; // Aurora chain slug, e.g. "base"
  chainLabel: string; // "Base"
  symbol: string; // "USDC"
  decimals: number;
}

/** Estimate shown to the client BEFORE they commit (dry quote). */
export interface PaymentPreview {
  chain: string;
  chainLabel: string;
  symbol: string;
  amountInFormatted: string; // what the client must send
  amountInUsd?: string;
  amountOutFormatted: string; // what the freelancer receives
  feeUsd?: number;
  timeEstimate?: number;
}

/** Old quotes that were replaced (expired/failed), kept for debugging and refund tracking. */
export interface QuoteHistoryEntry {
  depositAddress: string;
  deadline?: string;
  correlationId?: string | null;
  state?: string;
  replacedAt: string;
}

export interface Invoice {
  id: string;
  freelancerWallet: string; // Solana address that receives USDC
  clientName: string;
  amountUsd: number; // treated 1:1 with USDC
  description: string;
  dueDate: string; // YYYY-MM-DD
  status: InvoiceStatus;
  depositAddress: string; // empty until the client picks a chain (aurora)
  receivedAmount: number; // USDC received so far
  receiptTxSig?: string; // Step F: on-chain memo receipt
  createdAt: string; // ISO timestamp
  aurora?: AuroraInvoiceData;
  quoteHistory?: QuoteHistoryEntry[];
}

/** What the browser is allowed to see: no raw quote, no correlation id, masked refund address. */
export type PublicAuroraData = Omit<AuroraInvoiceData, "rawQuote" | "refundAddress" | "correlationId"> & {
  refundAddressShort: string;
};
export type PublicInvoice = Omit<Invoice, "aurora" | "quoteHistory"> & { aurora?: PublicAuroraData };

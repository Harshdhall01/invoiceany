import type { QuoteDetails, QuoteResponse } from "./types";

export interface QuoteSummary {
  amountInFormatted: string;
  amountInUsd?: string;
  amountOutFormatted: string;
  amountOutUsd?: string;
  feeUsd?: number; // what the client pays on top of the invoice, in USD (fees + slippage cushion)
  timeEstimate?: number;
}

/** Fee is derived (USD in minus USD out) so we never guess the units of Aurora's fee fields. */
export function summarizeQuote(d: QuoteDetails): QuoteSummary {
  const inUsd = Number(d.amountInUsd);
  const outUsd = Number(d.amountOutUsd);
  const feeUsd = Number.isFinite(inUsd) && Number.isFinite(outUsd) ? Math.max(0, Math.round((inUsd - outUsd) * 100) / 100) : undefined;
  return {
    amountInFormatted: d.amountInFormatted,
    amountInUsd: d.amountInUsd,
    amountOutFormatted: d.amountOutFormatted,
    amountOutUsd: d.amountOutUsd,
    feeUsd,
    timeEstimate: typeof d.timeEstimate === "number" ? d.timeEstimate : undefined,
  };
}

/**
 * The deadline the client must pay by = the deadline WE asked for, which Aurora echoes in quoteRequest.deadline.
 * (quote.deadline / timeWhenInactive came back exactly 72h later in real responses: address-inactive time.)
 * Falls back to our own requested value if the echo is missing or not a valid date.
 */
export function effectiveDeadline(q: QuoteResponse, requested: string): string {
  const echoed = (q.quoteRequest as { deadline?: unknown } | undefined)?.deadline;
  return typeof echoed === "string" && Number.isFinite(Date.parse(echoed)) ? echoed : requested;
}

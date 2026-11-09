import type { Invoice, PublicInvoice } from "./types";

const mask = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** Strip anything the browser must not see (raw quote incl. signature, full refund address). */
export function toPublicInvoice(invoice: Invoice): PublicInvoice {
  const { aurora, quoteHistory: _history, ...rest } = invoice;
  if (!aurora) return rest;
  const { rawQuote: _raw, refundAddress, correlationId: _cid, ...safe } = aurora;
  return { ...rest, aurora: { ...safe, refundAddressShort: mask(refundAddress) } };
}

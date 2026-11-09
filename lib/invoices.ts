import { getProvider, isAuroraProvider } from "./provider";
import { updateInvoice } from "./db";
import { computeStatus } from "./status";
import { auroraStatusGate } from "./rate-limit";
import type { Invoice } from "./types";

// Aurora states after which nothing can change: stop calling Aurora for these.
const TERMINAL_AURORA_STATES = new Set(["SUCCESS", "REFUNDED"]);

/**
 * Ask the provider for the latest payment state and persist any change.
 * With Aurora: at most one status call per invoice per 3s (otherwise the stored state is returned),
 * and none at all once the swap is finished.
 */
export async function refreshInvoice(invoice: Invoice, opts: { force?: boolean } = {}): Promise<Invoice> {
  if (invoice.status === "Refunded") return invoice;
  if (isAuroraProvider() && invoice.depositAddress && invoice.aurora) {
    if (invoice.aurora.state && TERMINAL_AURORA_STATES.has(invoice.aurora.state)) return invoice;
    const entered = auroraStatusGate().tryEnter(invoice.id);
    if (!entered && !opts.force) return invoice; // cached
  }
  try {
    const result = await getProvider().getPaymentStatus(invoice);
    const status = result.status ?? computeStatus(invoice, result.receivedAmount);

    const patch: Partial<Invoice> = { ...(result.patch ?? {}) };
    if (status !== invoice.status) patch.status = status;
    if (result.receivedAmount !== invoice.receivedAmount) patch.receivedAmount = result.receivedAmount;
    if (result.txSig && result.txSig !== invoice.receiptTxSig) patch.receiptTxSig = result.txSig;

    const current = invoice as unknown as Record<string, unknown>;
    const changed = Object.entries(patch).some(([k, v]) => JSON.stringify(v) !== JSON.stringify(current[k]));
    if (!changed) return invoice;
    return (await updateInvoice(invoice.id, patch)) ?? invoice;
  } catch (err) {
    console.error("refreshInvoice failed:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown error");
    return invoice; // serve last known state rather than failing the page
  }
}

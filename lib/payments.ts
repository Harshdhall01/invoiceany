// Shared logic for the payment routes. Server-only.
// Rule: the client chooses only the origin asset and a refund address.
// Amount, recipient and destination asset always come from the stored invoice.
import { z } from "zod";
import { getInvoice, updateInvoice } from "./db";
import { refreshInvoice } from "./invoices";
import { getProvider } from "./provider";
import type { CreatePaymentInput } from "./provider";
import { validateRefundAddress } from "./aurora/address";
import { ApiError, bad } from "./api-error";
import { withLock } from "./lock";
import { isPastDue } from "./status";
import type { Invoice, QuoteHistoryEntry } from "./types";

export const paymentBodySchema = z.object({
  originAssetId: z.string().trim().min(1, "is required").max(300),
  refundAddress: z.string().trim().min(1, "is required").max(200),
});

const notFound = () => new ApiError("NOT_FOUND", "Invoice not found.", 404);

export async function parsePaymentRequest(req: Request, id: string) {
  const json = await req.json().catch(() => {
    throw bad("INVALID_JSON", "Request body must be valid JSON.");
  });
  const input: CreatePaymentInput = paymentBodySchema.parse(json);

  const invoice = await getInvoice(id);
  if (!invoice) throw notFound();

  const options = await getProvider().listPaymentOptions();
  const option = options.find((o) => o.assetId === input.originAssetId);
  if (!option) throw bad("UNSUPPORTED_ASSET", "That asset is not available for payment.");

  const check = validateRefundAddress(option.chain, input.refundAddress);
  if (!check.ok) throw bad("INVALID_REFUND_ADDRESS", check.message);

  return { invoice, input, option, check };
}

export function assertNotSettled(invoice: Invoice) {
  if (invoice.status === "Paid" || invoice.status === "Overpaid")
    throw new ApiError("INVOICE_SETTLED", "This invoice has already been paid.", 409);
  if (invoice.status === "Refunded")
    throw new ApiError("INVOICE_SETTLED", "This invoice's payment was refunded. Ask the freelancer for a new invoice.", 409);
}

export function assertNotOverdue(invoice: Invoice) {
  if (isPastDue(invoice.dueDate)) throw new ApiError("INVOICE_EXPIRED", "This invoice is past its due date.", 409);
}

/** A quote is "live" unless it expired or failed. Pending/in-flight/underpaid-refund-pending all count as live. */
export function hasLiveQuote(invoice: Invoice): boolean {
  return Boolean(invoice.depositAddress && invoice.aurora) && invoice.status !== "Failed" && invoice.status !== "Expired";
}

/**
 * Idempotent: returns the existing live quote, or creates exactly one new quote.
 * Serialized per invoice, so a double-click or two tabs cannot create two quotes.
 */
export function createOrReusePayment(id: string, input: CreatePaymentInput): Promise<{ invoice: Invoice; reused: boolean }> {
  return withLock(`payment:${id}`, async () => {
    let invoice = await getInvoice(id);
    if (!invoice) throw notFound();
    invoice = await refreshInvoice(invoice, { force: true }); // be sure the status is current

    assertNotSettled(invoice);
    if (hasLiveQuote(invoice)) return { invoice, reused: true };
    assertNotOverdue(invoice);

    const patch = await getProvider().createPayment(invoice, input);

    const quoteHistory: QuoteHistoryEntry[] = [...(invoice.quoteHistory ?? [])];
    if (invoice.depositAddress && invoice.aurora && patch.depositAddress !== invoice.depositAddress) {
      quoteHistory.push({
        depositAddress: invoice.depositAddress,
        deadline: invoice.aurora.deadline,
        correlationId: invoice.aurora.correlationId,
        state: invoice.aurora.state,
        replacedAt: new Date().toISOString(),
      });
    }

    const saved = await updateInvoice(id, { ...patch, status: "Pending", receivedAmount: 0, quoteHistory });
    if (!saved) throw notFound();
    return { invoice: saved, reused: false };
  });
}

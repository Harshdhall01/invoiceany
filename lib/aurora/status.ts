import type { InvoiceStatus } from "../types";
import type { SwapDetails } from "./types";
import { isKnownStatus } from "./types";

export interface MappedStatus {
  status: InvoiceStatus;
  label: string; // friendly sub-label for the UI timeline
  receivedAmount: number; // USDC delivered to the freelancer so far
  known: boolean; // false => Aurora sent a status we don't know
}

export interface MapInput {
  rawStatus: string;
  swapDetails?: SwapDetails;
  quoteDeadline?: string; // ISO
  invoiceAmountUsd: number;
  now?: Date;
}

/** Pure mapping: Aurora status -> our invoice status. Never throws. */
export function mapAuroraStatus(input: MapInput): MappedStatus {
  const { rawStatus, swapDetails: d, quoteDeadline, invoiceAmountUsd } = input;
  const now = input.now ?? new Date();

  if (!isKnownStatus(rawStatus)) {
    console.warn(`[aurora] unknown status "${rawStatus}", treating as Pending`);
    return { status: "Pending", label: "Waiting", receivedAmount: 0, known: false };
  }

  switch (rawStatus) {
    case "PENDING_DEPOSIT": {
      const expired = quoteDeadline ? new Date(quoteDeadline).getTime() < now.getTime() : false;
      return expired
        ? { status: "Expired", label: "Quote expired, nothing deposited", receivedAmount: 0, known: true }
        : { status: "Pending", label: "Waiting for deposit", receivedAmount: 0, known: true };
    }
    case "KNOWN_DEPOSIT_TX":
      return { status: "Pending", label: "Deposit detected", receivedAmount: 0, known: true };
    case "PROCESSING":
      return { status: "Pending", label: "Swapping", receivedAmount: 0, known: true };
    case "SUCCESS": {
      const out = Number(d?.amountOutFormatted);
      const received = Number.isFinite(out) && out > 0 ? out : invoiceAmountUsd;
      // TODO(verify in the real test, step E): the docs say excess is refunded to refundTo after the
      // swap, but not which final status an overpayment ends in. We assume SUCCESS + refundedAmount > 0.
      const excessRefunded = Number(d?.refundedAmount ?? 0) > 0;
      return excessRefunded
        ? { status: "Overpaid", label: "Paid, excess refunded to client", receivedAmount: received, known: true }
        : { status: "Paid", label: "Paid", receivedAmount: received, known: true };
    }
    case "INCOMPLETE_DEPOSIT":
      return { status: "Underpaid", label: "Deposit too small, refund pending", receivedAmount: 0, known: true };
    case "REFUNDED":
      return { status: "Refunded", label: "Refunded to client", receivedAmount: 0, known: true };
    case "FAILED":
      return { status: "Failed", label: "Swap failed", receivedAmount: 0, known: true };
  }
}

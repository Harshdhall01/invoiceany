import type { Invoice, InvoiceStatus } from "./types";

export const TOLERANCE = 0.01; // USDC

export function isPastDue(dueDate: string, now = new Date()) {
  return new Date(`${dueDate}T23:59:59.999Z`).getTime() < now.getTime();
}

export function computeStatus(invoice: Invoice, received: number, now = new Date()): InvoiceStatus {
  if (invoice.status === "Refunded") return "Refunded"; // manual terminal state
  if (received > 0) {
    const diff = received - invoice.amountUsd;
    if (Math.abs(diff) <= TOLERANCE) return "Paid";
    return diff > 0 ? "Overpaid" : "Underpaid";
  }
  return isPastDue(invoice.dueDate, now) ? "Expired" : "Pending";
}

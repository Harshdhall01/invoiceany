import type { InvoiceStatus } from "@/lib/types";

const tone: Record<InvoiceStatus, string> = {
  Pending: "", Paid: "pane-mint", Overpaid: "pane-mint", Underpaid: "pane-slice", Expired: "pane-frost", Refunded: "pane-lilac", Failed: "pane-rose",
};

/** Decorative glass invoice. Its look follows the invoice status (missing slice = underpaid, frosted = expired...). */
export default function Pane({ amount, title, sub, status, small }: { amount?: string; title?: string; sub?: string; status?: InvoiceStatus; small?: boolean }) {
  return (
    <div aria-hidden className={`pane ${small ? "pane-sm" : ""} ${status ? tone[status] : ""}`}>
      <div className="pane-top">{title ?? "Invoice"}</div>
      <div>
        {amount && <div className="pane-amt">{amount}</div>}
        {sub && <div className="pane-sub">{sub}</div>}
      </div>
    </div>
  );
}

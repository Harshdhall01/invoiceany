import type { InvoiceStatus } from "@/lib/types";

// Semantic colors only: each status keeps one color everywhere.
const color: Record<InvoiceStatus, string> = {
  Pending: "#7CC4FF", Paid: "#5FE3B0", Underpaid: "#F5B94A", Overpaid: "#5FE3B0", Expired: "#8A93AD", Refunded: "#B7A6FF", Failed: "#FF6B81",
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = color[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-medium"
      style={{ color: c, background: `${c}29`, borderColor: `${c}61` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} aria-hidden />
      {status}
    </span>
  );
}

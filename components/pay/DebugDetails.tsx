"use client";
import { shortAddr } from "@/lib/format";
import type { PublicInvoice } from "@/lib/types";

// Shown only when NEXT_PUBLIC_DEBUG_AURORA=1. Contains nothing the client could not already see.
export default function DebugDetails({ invoice }: { invoice: PublicInvoice }) {
  const a = invoice.aurora;
  const rows: [string, string][] = [
    ["Invoice status", invoice.status],
    ["Raw Aurora status", a?.state ?? "(no status yet)"],
    ["Mapped label", a?.label ?? "-"],
    ["Quote created", a?.quotedAt ?? "-"],
    ["Pay-by deadline (requested)", a?.deadline ?? "-"],
    ["Address inactive at (Aurora)", a?.inactiveAt ?? "-"],
    ["Deposit address", invoice.depositAddress ? shortAddr(invoice.depositAddress) : "-"],
    ["Client must send", a ? `${a.amountInFormatted} ${a.originSymbol}` : "-"],
    ["Deposited (per Aurora)", a?.depositedFormatted ?? "-"],
    ["Refunded (per Aurora)", a?.refundedFormatted ?? "-"],
    ["Refund reason", a?.refundReason ?? "-"],
    ["Payout tx", a?.payoutTx?.hash ?? "-"],
  ];
  return (
    <details className="rounded-lg border border-dashed border-white/15 bg-white/[.06] p-3 text-xs text-pearl/65">
      <summary className="cursor-pointer font-medium">Debug details (DEBUG_AURORA)</summary>
      <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-pearl/55">{k}</dt>
            <dd className="break-all text-right font-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

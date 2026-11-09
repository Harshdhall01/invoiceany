"use client";
import type { PublicInvoice } from "@/lib/types";
import { CopyField } from "./ui";

/** What Aurora support asks for when funds get stuck. Only shows values we really have. */
export default function SupportDetails({ invoice }: { invoice: PublicInvoice }) {
  if (!invoice.depositAddress) return null;
  return (
    <details className="glass !rounded-2xl p-4 text-sm">
      <summary className="cursor-pointer font-medium text-pearl/75">Support details</summary>
      <div className="mt-3 space-y-2">
        <CopyField label="Deposit address" value={invoice.depositAddress} />
        <CopyField label="Invoice id" value={invoice.id} />
        {invoice.aurora?.payoutTx?.hash && <CopyField label="Payout transaction" value={invoice.aurora.payoutTx.hash} />}
        <p className="text-xs text-pearl/55">Share these when you contact support about a stuck payment.</p>
      </div>
    </details>
  );
}

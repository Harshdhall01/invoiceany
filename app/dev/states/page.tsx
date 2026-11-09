"use client";
// Dev-only preview of every pay-page state with fixture data. Works in any provider mode, never calls the API.
import { useMemo, useState } from "react";
import Pane from "@/components/Pane";
import StatusBadge from "@/components/StatusBadge";
import DepositStep from "@/components/pay/DepositStep";
import SupportDetails from "@/components/pay/SupportDetails";
import { ExpiredScreen, FailedScreen, PaidScreen, RefundedScreen, UnderpaidScreen } from "@/components/pay/Outcomes";
import { Card } from "@/components/pay/ui";
import { usd } from "@/lib/format";
import type { InvoiceStatus, PublicInvoice } from "@/lib/types";

type Key = "Waiting" | "Detected" | "Swapping" | "Paid" | "Overpaid" | "Underpaid" | "Refunded" | "Expired" | "Failed";
const KEYS: Key[] = ["Waiting", "Detected", "Swapping", "Paid", "Overpaid", "Underpaid", "Refunded", "Expired", "Failed"];

function make(key: Key, now: number): PublicInvoice {
  const status: InvoiceStatus = key === "Waiting" || key === "Detected" || key === "Swapping" ? "Pending" : (key as InvoiceStatus);
  const quotedAt = new Date(now - 5 * 60_000).toISOString();
  return {
    id: "inv_preview", freelancerWallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", clientName: "Northwind Studio", amountUsd: 3,
    description: "Brand identity, phase one", dueDate: new Date(now + 5 * 864e5).toISOString().slice(0, 10), status,
    depositAddress: "0x9a3F5c1e7B2d4A60c8E1f93D7b5A24cE80F1d6B7", createdAt: quotedAt,
    receivedAmount: key === "Paid" ? 3 : key === "Overpaid" ? 3 : key === "Underpaid" ? 0 : 0,
    aurora: {
      originAssetId: "preview", originChain: "base", originSymbol: "USDC", chainLabel: "Base", refundAddressShort: "0x97f4…a3b1",
      deadline: new Date(now + 25 * 60_000).toISOString(), quotedAt, amountIn: "3270000", amountInFormatted: "3.27", minAmountIn: "3270000", feeUsd: 0.27,
      state: key === "Detected" ? "KNOWN_DEPOSIT_TX" : key === "Swapping" ? "PROCESSING" : key === "Paid" || key === "Overpaid" ? "SUCCESS" : "PENDING_DEPOSIT",
      depositedFormatted: key === "Underpaid" ? "2.40" : key === "Failed" || key === "Refunded" ? "3.27" : key === "Overpaid" ? "3.60" : undefined,
      refundedFormatted: key === "Refunded" ? "3.27" : key === "Overpaid" ? "0.33" : undefined,
      refundReason: key === "Refunded" ? "Swap could not be completed" : key === "Failed" ? "Route unavailable" : undefined,
    },
  };
}

export default function StatesPreview() {
  const [key, setKey] = useState<Key>("Waiting");
  const now = useMemo(() => Date.now(), []);
  if (process.env.NODE_ENV === "production") return <p className="py-12 text-center text-pearl/65">This page is only available in development.</p>;
  const invoice = make(key, now);
  const s = invoice.status;

  let body;
  if (key === "Paid" || key === "Overpaid") body = <PaidScreen invoice={invoice} />;
  else if (key === "Refunded") body = <RefundedScreen invoice={invoice} />;
  else if (key === "Failed") body = <FailedScreen invoice={invoice} canRetry onRetry={() => {}} />;
  else if (key === "Underpaid") body = <UnderpaidScreen invoice={invoice} />;
  else if (key === "Expired") body = <ExpiredScreen invoice={invoice} canRetry onRetry={() => {}} />;
  else body = <DepositStep invoice={invoice} />;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="glass !rounded-2xl p-4">
        <p className="text-sm font-medium text-amber-200">Dev only: state preview (fixture data, no API calls)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => setKey(k)} aria-pressed={key === k}
              className={`rounded-full border px-3 py-1 text-sm ${key === k ? "border-sky-300 bg-sky-300/15" : "border-white/15 bg-white/10 hover:bg-white/20"}`}>{k}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-pearl/55">The first step (choose chain) needs the live API, so open a real /pay/[id] link for that one.</p>
      </div>
      <Card>
        <div className="mb-5 flex justify-center"><Pane small status={s} title="Invoice" sub={s} /></div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-sm text-pearl/55">Invoice for</p><h1 className="truncate text-xl font-bold">{invoice.clientName}</h1></div>
          <StatusBadge status={s} />
        </div>
        <p className="mt-4 text-4xl font-semibold tracking-tight">{usd(invoice.amountUsd)}</p>
        <p className="mt-2 text-pearl/65">{invoice.description}</p>
      </Card>
      {body}
      <SupportDetails invoice={invoice} />
    </div>
  );
}

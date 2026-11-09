"use client";

import { useCallback, useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import ChooseStep from "@/components/pay/ChooseStep";
import DepositStep from "@/components/pay/DepositStep";
import DevPanel from "@/components/pay/DevPanel";
import DebugDetails from "@/components/pay/DebugDetails";
import { ExpiredScreen, FailedScreen, PaidScreen, RefundedScreen, UnderpaidScreen } from "@/components/pay/Outcomes";
import { Card } from "@/components/pay/ui";
import Pane from "@/components/Pane";
import SupportDetails from "@/components/pay/SupportDetails";
import { ApiClientError, apiFetch } from "@/lib/client-api";
import { fmtDate, shortAddr, usd } from "@/lib/format";
import { isPastDue } from "@/lib/status";
import type { PublicInvoice } from "@/lib/types";

const DEV = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === "mock";

export default function PayPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retrying, setRetrying] = useState(false); // client chose "start a new payment" after Expired/Failed

  const load = useCallback(async () => {
    try {
      setInvoice(await apiFetch<PublicInvoice>(`/api/invoices/${id}`));
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) setNotFound(true);
      // other errors: keep showing the last known state
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (notFound) return <p className="py-12 text-center text-pearl/65">This invoice does not exist. Check the link with the person who sent it.</p>;
  if (!invoice) {
    return (
      <div className="mx-auto max-w-xl space-y-4" aria-busy="true" aria-label="Loading invoice">
        <div className="glass space-y-4 p-6"><div className="skel h-5 w-1/3" /><div className="skel h-12 w-2/3" /><div className="skel h-4 w-full" /></div>
        <div className="glass space-y-3 p-6"><div className="skel h-5 w-1/2" /><div className="skel h-24 w-full" /></div>
      </div>
    );
  }

  const s = invoice.status;
  const hasQuote = Boolean(invoice.depositAddress && invoice.aurora);
  const canRetryOverdue = !isPastDue(invoice.dueDate);
  const nothingDeposited = !invoice.aurora?.depositedFormatted;

  let body;
  if (s === "Paid" || s === "Overpaid") body = <PaidScreen invoice={invoice} />;
  else if (s === "Refunded") body = <RefundedScreen invoice={invoice} />;
  else if (retrying && (s === "Failed" || s === "Expired")) {
    body = <ChooseStep invoice={invoice} onCreated={(inv) => { setInvoice(inv); setRetrying(false); }} />;
  } else if (s === "Failed") {
    body = <FailedScreen invoice={invoice} canRetry={canRetryOverdue && nothingDeposited} onRetry={() => setRetrying(true)} />;
  } else if (s === "Underpaid") body = <UnderpaidScreen invoice={invoice} />;
  else if (s === "Expired") body = <ExpiredScreen invoice={invoice} canRetry={canRetryOverdue} onRetry={() => setRetrying(true)} />;
  else body = hasQuote ? <DepositStep invoice={invoice} /> : <ChooseStep invoice={invoice} onCreated={setInvoice} />;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card>
        <div className="mb-5 flex justify-center"><Pane small status={s} title="Invoice" sub={s} /></div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-pearl/55">Invoice for</p>
            <h1 className="truncate text-xl font-bold">{invoice.clientName}</h1>
          </div>
          <StatusBadge status={s} />
        </div>
        <p className="mt-4 text-4xl font-semibold tracking-tight">{usd(invoice.amountUsd)}</p>
        {invoice.description && <p className="mt-2 text-pearl/65">{invoice.description}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-pearl/55">Due</dt>
          <dd className="text-right">{fmtDate(invoice.dueDate)}</dd>
          <dt className="text-pearl/55">Payee wallet</dt>
          <dd className="text-right font-mono">{shortAddr(invoice.freelancerWallet)}</dd>
        </dl>
      </Card>

      {body}

      <SupportDetails invoice={invoice} />

      {process.env.NEXT_PUBLIC_DEBUG_AURORA === "1" && <DebugDetails invoice={invoice} />}

      {DEV && <DevPanel invoiceId={id} amountUsd={invoice.amountUsd} onDone={load} />}
    </div>
  );
}

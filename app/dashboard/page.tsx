"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import StatusBadge from "@/components/StatusBadge";
import { CopyButton } from "@/components/pay/ui";
import { fmtDate, usd } from "@/lib/format";
import type { PublicInvoice } from "@/lib/types";

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const [invoices, setInvoices] = useState<PublicInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wallet = publicKey?.toBase58();

  useEffect(() => {
    if (!wallet) {
      setInvoices(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/invoices?wallet=${encodeURIComponent(wallet)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d)) setInvoices(d);
        else setError(d.error?.message ?? "Failed to load invoices");
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (!wallet) {
    return <p className="py-12 text-center text-pearl/65">Connect your wallet (top right) to see your invoices.</p>;
  }

  // Only real numbers from the stored invoices.
  const received = (invoices ?? []).filter((i) => i.status === "Paid" || i.status === "Overpaid").reduce((a, i) => a + i.receivedAmount, 0);
  const pending = (invoices ?? []).filter((i) => i.status === "Pending").reduce((a, i) => a + i.amountUsd, 0);
  const attention = (invoices ?? []).filter((i) => i.status === "Underpaid" || i.status === "Failed").length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your invoices</h1>
        <Link href="/invoice/new" className="rounded-lg bg-gradient-to-b from-white to-[#cfd6ff] px-4 py-2 text-sm font-medium text-ink hover:brightness-95">
          New invoice
        </Link>
      </div>

      {invoices && invoices.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {([["Received", usd(received)], ["Pending", usd(pending)], ["Needs attention", String(attention)]] as const).map(([k, v]) => (
            <div key={k} className="glass !rounded-2xl p-5">
              <p className="text-sm text-pearl/55">{k}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{v}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {!invoices && !error && <div className="glass mt-6 space-y-3 p-6" aria-busy="true"><div className="skel h-5 w-1/3" /><div className="skel h-10 w-full" /><div className="skel h-10 w-full" /></div>}
      {invoices && invoices.length === 0 && (
        <div className="glass mt-6 p-10 text-center">
          <p className="text-pearl/65">No invoices yet. Create one and send the link to your client.</p>
          <Link href="/invoice/new" className="mt-4 inline-block rounded-full bg-gradient-to-b from-white to-[#cfd6ff] px-6 py-2.5 font-medium text-ink hover:brightness-95">Create an invoice</Link>
        </div>
      )}

      {invoices && invoices.length > 0 && (
        <div className="glass mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/15 bg-white/[.05] text-pearl/55">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-white/10 last:border-0">
                  <td className="px-4 py-3 font-medium">{i.clientName}</td>
                  <td className="px-4 py-3">{usd(i.amountUsd)}</td>
                  <td className="px-4 py-3">
                    {i.status === "Paid" || i.status === "Overpaid" ? (
                      <>
                        <span className="font-medium text-emerald-300">{usd(i.receivedAmount)} USDC</span>
                        <span className="block text-xs text-pearl/55">
                          received on Solana
                          {i.aurora?.payoutTx && (
                            <> · <a className="text-sky-300 hover:underline" href={i.aurora.payoutTx.explorerUrl} target="_blank" rel="noreferrer">tx</a></>
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        {usd(i.receivedAmount)}
                        {i.aurora?.label && i.status !== "Expired" && <span className="block text-xs text-pearl/55">{i.aurora.label}</span>}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">{fmtDate(i.dueDate)}</td>
                  <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <CopyButton text={`${typeof window !== "undefined" ? window.location.origin : ""}/pay/${i.id}`} label="Copy pay link" />
                      <Link href={`/pay/${i.id}`} className="text-sky-300 hover:underline">Open</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

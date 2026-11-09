"use client";
import { useEffect, useRef, useState } from "react";
import { ApiClientError, apiFetch, postJson } from "@/lib/client-api";
import { usd } from "@/lib/format";
import type { PaymentOption, PaymentPreview, PublicInvoice } from "@/lib/types";
import { Card } from "./ui";
import ChainMark from "./ChainMark";

interface PreviewResponse {
  preview: PaymentPreview;
  refundAddressCheck: { verified: boolean; note: string | null } | null;
}

export default function ChooseStep({ invoice, onCreated }: { invoice: PublicInvoice; onCreated: (inv: PublicInvoice) => void }) {
  const [options, setOptions] = useState<PaymentOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState("");
  const [refund, setRefund] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    apiFetch<{ options: PaymentOption[] }>("/api/payment-options")
      .then((r) => {
        setOptions(r.options);
        if (r.options[0]) setAssetId(r.options[0].assetId);
      })
      .catch((e: ApiClientError) => setLoadError(e.message));
  }, []);

  // Debounced dry quote: shows the exact total + fee BEFORE the client commits.
  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    setCreateError(null);
    const addr = refund.trim();
    if (!assetId || !addr) return;
    const mine = ++seq.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const r = await postJson<PreviewResponse>(`/api/invoices/${invoice.id}/quote-preview`, { originAssetId: assetId, refundAddress: addr });
        if (mine === seq.current) setPreview(r);
      } catch (e) {
        if (mine === seq.current) setPreviewError(e instanceof ApiClientError ? e.message : "Could not get an estimate.");
      } finally {
        if (mine === seq.current) setPreviewing(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [assetId, refund, invoice.id]);

  async function create() {
    setCreating(true);
    setCreateError(null);
    try {
      const r = await postJson<{ invoice: PublicInvoice }>(`/api/invoices/${invoice.id}/payment`, { originAssetId: assetId, refundAddress: refund.trim() });
      onCreated(r.invoice);
    } catch (e) {
      setCreateError(e instanceof ApiClientError ? e.message : "Could not create the payment address.");
      setCreating(false);
    }
  }

  const p = preview?.preview;
  const feePct = p?.feeUsd !== undefined ? p.feeUsd / invoice.amountUsd : 0;

  return (
    <Card>
      <h2 className="text-lg font-bold">1. Choose how you want to pay</h2>
      <p className="mt-1 text-sm text-pearl/65">Pay from almost any chain. The freelancer receives exactly {usd(invoice.amountUsd)} in USDC on Solana.</p>

      {loadError && <p className="mt-4 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-300">{loadError}</p>}
      {!options && !loadError && <p className="mt-4 text-sm text-pearl/55">Loading payment options…</p>}
      {options && options.length === 0 && <p className="mt-4 text-sm text-pearl/65">No payment options are available right now.</p>}

      {options && options.length > 0 && (
        <>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Pay with</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options.map((o) => (
                <button
                  key={o.assetId}
                  type="button"
                  onClick={() => setAssetId(o.assetId)}
                  aria-pressed={assetId === o.assetId}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm ${assetId === o.assetId ? "border-sky-300 bg-sky-300/15 ring-1 ring-sky-300" : "border-white/15 hover:bg-white/10"}`}
                >
                  <ChainMark chain={o.chain} />
                  <span>
                    <span className="font-semibold">{o.symbol}</span>
                    <span className="block text-xs text-pearl/55">on {o.chainLabel}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block text-sm font-medium">
            Your refund address
            <input
              value={refund}
              onChange={(e) => setRefund(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 font-mono text-sm outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-300"
            />
          </label>
          <p className="mt-1 text-xs text-pearl/55">
            If you underpay or the swap fails, funds are returned here. Use an address you control on the same chain you are paying from.
          </p>

          {previewing && <p className="mt-4 text-sm text-pearl/55">Getting the exact amount…</p>}
          {previewError && <p className="mt-4 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-300">{previewError}</p>}
          {preview?.refundAddressCheck && !preview.refundAddressCheck.verified && (
            <p className="mt-4 rounded-lg bg-amber-300/10 p-3 text-sm text-amber-200">{preview.refundAddressCheck.note}</p>
          )}

          {p && (
            <div className="mt-4 rounded-lg border border-sky-300/30 bg-sky-300/10 p-4">
              <p className="text-sm text-pearl/65">You will send about</p>
              <p className="text-3xl font-semibold tracking-tight">{p.amountInFormatted} <span className="text-xl">{p.symbol}</span></p>
              <p className="text-xs text-pearl/55">on {p.chainLabel}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-pearl/65">Freelancer receives</dt><dd className="font-medium">{usd(invoice.amountUsd)} USDC</dd></div>
                {p.feeUsd !== undefined && (
                  <div className="flex justify-between"><dt className="text-pearl/65">Fees (swap + bridge)</dt><dd className="font-medium">≈ {usd(p.feeUsd)}</dd></div>
                )}
                {p.timeEstimate !== undefined && p.timeEstimate > 0 && (
                  <div className="flex justify-between"><dt className="text-pearl/65">Estimated time</dt><dd className="font-medium">~{p.timeEstimate}s after you send</dd></div>
                )}
              </dl>
              {feePct > 0.05 && (
                <p className="mt-3 text-xs text-amber-200">Fees are a larger share on small invoices because part of the cost is fixed.</p>
              )}
              <p className="mt-3 text-xs text-pearl/55">This is an estimate. The exact amount to send is confirmed on the next step.</p>
            </div>
          )}

          {createError && <p className="mt-4 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-300">{createError}</p>}
          <button
            type="button"
            onClick={create}
            disabled={!p || creating || previewing}
            className="mt-4 w-full rounded-lg bg-gradient-to-b from-white to-[#cfd6ff] py-3 font-medium text-ink hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating your payment address…" : "Get payment address"}
          </button>
        </>
      )}
    </Card>
  );
}

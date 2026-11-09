"use client";
import { QRCodeSVG } from "qrcode.react";
import { usd } from "@/lib/format";
import type { PublicInvoice } from "@/lib/types";
import { Card, CopyField } from "./ui";
import { fmtCountdown, useCountdown } from "./useCountdown";

const STAGES = ["Waiting for deposit", "Deposit detected", "Swapping", "Paid"];

function stageIndex(state?: string): number {
  switch (state) {
    case "KNOWN_DEPOSIT_TX": return 1;
    case "PROCESSING": return 2;
    case "SUCCESS": return 3;
    default: return 0;
  }
}

export function Timeline({ state }: { state?: string }) {
  const current = stageIndex(state);
  return (
    <ol className="space-y-3">
      {STAGES.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done ? "bg-emerald-300 text-ink" : active ? "bg-gradient-to-b from-white to-[#cfd6ff] text-ink" : "bg-white/15 text-pearl/55"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "font-semibold" : done ? "text-pearl/75" : "text-pearl/40"}>{label}</span>
            {active && i < 3 && <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" aria-label="in progress" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function DepositStep({ invoice }: { invoice: PublicInvoice }) {
  const a = invoice.aurora!;
  const left = useCountdown(a.deadline);
  const closed = left === 0;
  const urgent = left !== null && left > 0 && left < 5 * 60_000;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-bold">2. Send your payment</h2>
        <p className="mt-3 text-sm text-pearl/65">Send exactly</p>
        <p className="text-3xl font-semibold tracking-tight">{a.amountInFormatted} <span className="text-xl">{a.originSymbol}</span></p>
        <p className="text-sm text-pearl/65">on <strong>{a.chainLabel ?? a.originChain}</strong></p>
        {a.feeUsd !== undefined && (
          <p className="mt-1 text-xs text-pearl/55">
            Includes about {usd(a.feeUsd)} in fees. The freelancer receives {usd(invoice.amountUsd)} USDC.
          </p>
        )}

        <div className="mt-4 rounded-lg border border-amber-300/40 bg-amber-300/10 p-3 text-sm text-amber-100">
          <strong>Only send {a.originSymbol} on {a.chainLabel ?? a.originChain}, and send the exact amount.</strong>{" "}
          Other assets or networks can be lost. A smaller amount is refunded to you, not credited.
        </div>

        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-2xl bg-white p-3">
            <QRCodeSVG value={invoice.depositAddress} size={160} />
          </div>
          <div className="w-full min-w-0 space-y-2">
            <CopyField label="Deposit address" value={invoice.depositAddress} />
            <CopyField label="Amount" value={a.amountInFormatted} />
            {a.depositMemo && (
              <>
                <CopyField label="Memo (required)" value={a.depositMemo} />
                <p className="text-xs text-rose-300">This chain needs the memo. Without it the deposit cannot be matched.</p>
              </>
            )}
          </div>
        </div>

        {left !== null && !closed && a.quotedAt && (() => {
          const total = Math.max(1, new Date(a.deadline).getTime() - new Date(a.quotedAt).getTime());
          const frac = Math.min(1, Math.max(0, left / total));
          return (
            <svg width="44" height="44" viewBox="0 0 44 44" className="mt-4 -rotate-90" role="img" aria-label={`Time left: ${fmtCountdown(left)}`}>
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none" stroke={urgent ? "#F5B94A" : "#7CC4FF"} strokeWidth="4" strokeLinecap="round" strokeDasharray={113} strokeDashoffset={113 * (1 - frac)} />
            </svg>
          );
        })()}
        <p className={`mt-4 text-sm font-medium ${closed ? "text-rose-300" : urgent ? "text-amber-300" : "text-pearl/75"}`}>
          {left === null ? null : closed ? "The payment window has closed. Updating…" : `Send within ${fmtCountdown(left)}`}
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold  text-pearl/55">Progress</h3>
        <Timeline state={a.state} />
        <p className="mt-4 text-xs text-pearl/55">
          This page updates automatically. If something goes wrong, funds are returned to {a.refundAddressShort}.
        </p>
      </Card>
    </div>
  );
}

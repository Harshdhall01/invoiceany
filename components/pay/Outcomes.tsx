"use client";
import { amt, fmtDateTime, usd } from "@/lib/format";
import type { PublicInvoice } from "@/lib/types";
import { Facts, Outcome } from "./ui";

const sym = (i: PublicInvoice) => i.aurora?.originSymbol ?? "USDC";
const refundTo = (i: PublicInvoice) => i.aurora?.refundAddressShort ?? "the refund address you provided";

export function PaidScreen({ invoice }: { invoice: PublicInvoice }) {
  const a = invoice.aurora;
  const over = invoice.status === "Overpaid";
  return (
    <Outcome tone="green" icon="✓" title="Payment complete" lead={`The freelancer received ${usd(invoice.receivedAmount)} USDC on Solana. Thank you!`}>
      <Facts
        rows={[
          ["Delivered", `${usd(invoice.receivedAmount)} USDC (Solana)`],
          ...(a?.payoutTx ? [["Payout transaction", <a key="tx" className="text-sky-300 underline" href={a.payoutTx.explorerUrl} target="_blank" rel="noreferrer">View on explorer</a>] as [string, React.ReactNode]] : []),
        ]}
      />
      {over && (
        <p className="rounded-lg bg-sky-300/10 p-3 text-sm text-sky-100">
          You sent more than required. The invoice is fully paid
          {a?.refundedFormatted ? ` and the extra ${a.refundedFormatted} ${sym(invoice)} is being returned to ${refundTo(invoice)}.` : ", and any excess is returned to your refund address."}
        </p>
      )}
    </Outcome>
  );
}

export function UnderpaidScreen({ invoice }: { invoice: PublicInvoice }) {
  const a = invoice.aurora;
  const deposited = Number(a?.depositedFormatted ?? invoice.receivedAmount);
  const required = Number(a?.amountInFormatted ?? invoice.amountUsd);
  const missing = Math.max(0, required - (Number.isFinite(deposited) ? deposited : 0));
  const s = sym(invoice);
  return (
    <Outcome
      tone="orange"
      icon="!"
      title="Payment incomplete"
      lead="The amount that arrived was less than the invoice requires, so it was not credited. Your deposit is being refunded automatically."
    >
      <Facts
        rows={[
          ["You sent", `${amt(deposited)} ${s}`],
          ["Required", `${amt(required)} ${s}`],
          ["Missing", <span key="m" className="text-amber-300">{amt(missing)} {s}</span>],
          ["Refund goes to", <span key="r" className="font-mono">{refundTo(invoice)}</span>],
          ...(a?.deadline ? [["Refund expected by", fmtDateTime(a.deadline)] as [string, React.ReactNode]] : []),
        ]}
      />
      <p className="text-sm text-pearl/75">
        <strong>You don&apos;t need to do anything.</strong> Once the refund lands, ask the freelancer for a new payment link and send the full amount.
        This page keeps updating.
      </p>
    </Outcome>
  );
}

export function ExpiredScreen({ invoice, canRetry, onRetry }: { invoice: PublicInvoice; canRetry: boolean; onRetry: () => void }) {
  const hadQuote = Boolean(invoice.aurora);
  return (
    <Outcome
      tone="slate"
      icon="⏱"
      title={hadQuote ? "Payment window expired" : "Invoice expired"}
      lead={
        hadQuote
          ? "No deposit arrived before the deadline, so this payment address is closed. Please don't send funds to it."
          : "This invoice is past its due date and can no longer be paid. Contact the freelancer for an updated invoice."
      }
    >
      {hadQuote && (
        <p className="text-sm text-pearl/75">
          If you already sent funds, they are refunded to <span className="font-mono">{refundTo(invoice)}</span>.
        </p>
      )}
      {hadQuote && canRetry && (
        <button onClick={onRetry} className="w-full rounded-lg bg-gradient-to-b from-white to-[#cfd6ff] py-3 font-medium text-ink hover:brightness-95">
          Start a new payment
        </button>
      )}
    </Outcome>
  );
}

export function RefundedScreen({ invoice }: { invoice: PublicInvoice }) {
  const a = invoice.aurora;
  const s = sym(invoice);
  return (
    <Outcome tone="purple" icon="↩" title="Payment refunded" lead="This payment did not complete, and your funds have been returned. Nothing was delivered to the freelancer.">
      <Facts
        rows={[
          ["Returned to", <span key="r" className="font-mono">{refundTo(invoice)}</span>],
          ...(a?.refundedFormatted ? [["Amount refunded", `${a.refundedFormatted} ${s}`] as [string, React.ReactNode]] : []),
          ...(a?.refundReason ? [["Reason", a.refundReason] as [string, React.ReactNode]] : []),
        ]}
      />
      <p className="text-sm text-pearl/75">To try again, ask the freelancer for a new invoice.</p>
    </Outcome>
  );
}

export function FailedScreen({ invoice, canRetry, onRetry }: { invoice: PublicInvoice; canRetry: boolean; onRetry: () => void }) {
  const a = invoice.aurora;
  const deposited = Boolean(a?.depositedFormatted);
  return (
    <Outcome
      tone="red"
      icon="✕"
      title="The swap failed"
      lead={
        deposited
          ? "Something went wrong while converting your payment. The freelancer was not paid, and your deposit will be returned."
          : "Something went wrong while processing this payment. No funds were taken."
      }
    >
      <Facts
        rows={[
          ...(deposited ? [["Your deposit", `${a!.depositedFormatted} ${sym(invoice)}`] as [string, React.ReactNode]] : []),
          ["Refund goes to", <span key="r" className="font-mono">{refundTo(invoice)}</span>],
          ...(a?.refundReason ? [["Reason", a.refundReason] as [string, React.ReactNode]] : []),
        ]}
      />
      {canRetry ? (
        <button onClick={onRetry} className="w-full rounded-lg bg-gradient-to-b from-white to-[#cfd6ff] py-3 font-medium text-ink hover:brightness-95">
          Try a new payment
        </button>
      ) : (
        <p className="text-sm text-pearl/75">Please wait until the refund arrives before trying again. This page keeps updating.</p>
      )}
    </Outcome>
  );
}

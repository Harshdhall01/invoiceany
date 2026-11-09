"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Pane from "@/components/Pane";
import { usd } from "@/lib/format";

const inputCls =
  "mt-1 w-full rounded-xl border border-white/15 bg-white/[.07] px-3 py-2.5 text-pearl placeholder:text-pearl/40 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-300";

export default function NewInvoicePage() {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ clientName: "", amountUsd: "", description: "" });
  const defaultDue = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!publicKey) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancerWallet: publicKey.toBase58(),
          clientName: f.get("clientName"),
          amountUsd: Number(f.get("amountUsd")),
          dueDate: f.get("dueDate"),
          description: f.get("description"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to create invoice");
      router.push(`/pay/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!publicKey) {
    return <p className="py-12 text-center text-pearl/65">Connect your wallet (top right) to create an invoice.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">New invoice</h1>
      <p className="mt-1 text-sm text-pearl/65">Paid out as USDC to your connected wallet.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
      <form
        onSubmit={onSubmit}
        onChange={(e) => {
          const f = new FormData(e.currentTarget);
          setDraft({ clientName: String(f.get("clientName") ?? ""), amountUsd: String(f.get("amountUsd") ?? ""), description: String(f.get("description") ?? "") });
        }}
        className="glass space-y-4 p-6"
      >
        <label className="block text-sm font-medium">
          Client name
          <input name="clientName" required className={inputCls} placeholder="Acme Inc." />
        </label>
        <label className="block text-sm font-medium">
          Amount (USD)
          <input name="amountUsd" type="number" min="0.01" step="0.01" required className={inputCls} placeholder="500.00" />
        </label>
        <label className="block text-sm font-medium">
          Due date
          <input name="dueDate" type="date" required defaultValue={defaultDue} className={inputCls} />
        </label>
        <label className="block text-sm font-medium">
          Description
          <textarea name="description" rows={3} className={inputCls} placeholder="Landing page design, 2 rounds of revisions" />
        </label>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-gradient-to-b from-white to-[#cfd6ff] py-2.5 font-medium text-ink hover:brightness-95 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create invoice"}
        </button>
      </form>
      <div className="flex justify-center md:sticky md:top-24 md:self-start">
        <Pane title={draft.description || "What it is for"} amount={usd(Number(draft.amountUsd) || 0)} sub={draft.clientName ? `Bill to ${draft.clientName}` : "Client name"} />
      </div>
      </div>
    </div>
  );
}

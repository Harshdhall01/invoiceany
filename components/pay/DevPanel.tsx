"use client";

export default function DevPanel({ invoiceId, amountUsd, onDone }: { invoiceId: string; amountUsd: number; onDone: () => void }) {
  async function simulate(amount: number) {
    await fetch("/api/dev/simulate-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, amount }),
    });
    onDone();
  }
  const btn = "rounded-full border border-amber-300/50 bg-white/10 px-3 py-1";
  return (
    <div className="rounded-xl border border-dashed border-amber-300/50 bg-amber-300/10 p-4 text-sm">
      <p className="font-medium text-amber-100">Dev only: simulate a payment (mock provider)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => simulate(amountUsd)} className={btn}>Exact</button>
        <button onClick={() => simulate(Math.round(amountUsd * 50) / 100)} className={btn}>Underpay 50%</button>
        <button onClick={() => simulate(Math.round(amountUsd * 110) / 100)} className={btn}>Overpay +10%</button>
        <button onClick={() => simulate(0)} className={btn}>Reset</button>
      </div>
    </div>
  );
}

"use client";
import { ReactNode, useState } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass p-5 sm:p-6 ${className}`}>{children}</div>;
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea"); // fallback for non-secure contexts
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await writeClipboard(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

/** A labelled value with a copy button (address, amount, memo). */
export function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/[.05] p-3">
      <p className="text-xs font-medium  text-pearl/55">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className={`min-w-0 break-all text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

const tones = {
  amber: { ring: "border-amber-300/30 bg-amber-300/10", icon: "bg-amber-300/20 text-amber-200", title: "text-amber-100" },
  orange: { ring: "border-amber-300/30 bg-amber-300/10", icon: "bg-amber-300/20 text-amber-200", title: "text-amber-100" },
  red: { ring: "border-rose-400/30 bg-rose-400/10", icon: "bg-rose-400/20 text-rose-200", title: "text-rose-100" },
  purple: { ring: "border-violet-300/30 bg-violet-300/10", icon: "bg-violet-300/20 text-violet-200", title: "text-violet-100" },
  slate: { ring: "border-white/15 bg-white/[.06]", icon: "bg-white/15 text-pearl/75", title: "text-pearl" },
  green: { ring: "border-emerald-300/30 bg-emerald-300/10", icon: "bg-emerald-300/20 text-emerald-200", title: "text-emerald-100" },
} as const;

/** Shared layout for the outcome screens (Paid / Underpaid / Expired / Refunded / Failed). */
export function Outcome({
  tone, icon, title, lead, children,
}: { tone: keyof typeof tones; icon: string; title: string; lead: ReactNode; children?: ReactNode }) {
  const t = tones[tone];
  return (
    <div className={`rounded-[28px] border p-5 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.3)] sm:p-6 ${t.ring}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${t.icon}`} aria-hidden>{icon}</span>
        <div className="min-w-0">
          <h2 className={`text-lg font-bold ${t.title}`}>{title}</h2>
          <p className="mt-1 text-sm text-pearl/75">{lead}</p>
        </div>
      </div>
      {children && <div className="mt-4 space-y-3">{children}</div>}
    </div>
  );
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-white/10 rounded-lg bg-white/[.06] px-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-pearl/55">{k}</dt>
          <dd className="min-w-0 break-all text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

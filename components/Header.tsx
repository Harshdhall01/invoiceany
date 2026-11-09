"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { SOLANA_NETWORK } from "./SolanaProvider";

// Wallet button reads window state, so render it client-side only (avoids hydration mismatch).
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-ink/40 backdrop-blur-2xl" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">InvoiceAny</Link>
          <nav className="hidden gap-4 text-sm text-pearl/65 sm:flex" aria-label="Main">
            <Link href="/dashboard" className="hover:text-pearl">Dashboard</Link>
            <Link href="/invoice/new" className="hover:text-pearl">New invoice</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-pearl/65">{SOLANA_NETWORK}</span>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}

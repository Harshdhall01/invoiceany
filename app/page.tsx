"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Pane from "@/components/Pane";
import type { InvoiceStatus } from "@/lib/types";

const COINS = ["#7CC4FF", "#B7A6FF", "#F5B94A", "#FF6B81", "#5FE3B0", "#8A93AD"];
const SCENES = 5;
const btn = "inline-block rounded-full bg-gradient-to-b from-white to-[#cfd6ff] px-7 py-3 font-semibold text-ink shadow-[0_10px_30px_-10px_rgba(124,196,255,.6)] hover:brightness-95";
const ghost = "inline-block rounded-full border border-white/15 bg-white/10 px-7 py-3 font-semibold hover:bg-white/20";

export default function Home() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const story = useRef<HTMLElement>(null);
  const [scene, setScene] = useState(0);
  const [frosted, setFrosted] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const on = () => {
      const el = story.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = Math.min(0.999, Math.max(0, -r.top / Math.max(1, el.offsetHeight - window.innerHeight)));
      setScene(Math.floor(p * SCENES));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);

  useEffect(() => {
    setFrosted(false);
    if (scene !== 3) return;
    const t = setTimeout(() => setFrosted(true), 2200);
    return () => clearTimeout(t);
  }, [scene]);

  const transforms = [
    `rotateY(${-18 + tilt.x}deg) rotateX(${6 + tilt.y}deg)`,
    "rotateY(14deg) scale(.92)",
    "translateX(-18vw) rotateY(22deg) scale(.9)",
    "rotateY(-8deg)",
    "scale(1.06)",
  ];
  const paneStatus: InvoiceStatus | undefined = scene === 3 ? (frosted ? "Expired" : "Underpaid") : scene === 4 ? "Paid" : undefined;

  const create = connected
    ? <Link href="/invoice/new" className={btn}>Create an invoice</Link>
    : <button type="button" onClick={() => setVisible(true)} className={btn}>Create an invoice</button>;

  return (
    <>
      <section
        ref={story}
        className="lp-story"
        aria-label="How InvoiceAny works"
        onPointerMove={(e) => { if (scene === 0) setTilt({ x: (e.clientX / window.innerWidth - 0.5) * 24, y: (e.clientY / window.innerHeight - 0.5) * -14 }); }}
      >
        <div className="lp-stage">
          <div className="lp-ribbon" style={{ opacity: scene === 2 ? 1 : 0 }} aria-hidden />
          <div className="lp-obj" aria-hidden>
            <div className="lp-obj-in" style={{ transform: transforms[scene] }}>
              {COINS.map((c, k) => {
                const a = (k / COINS.length) * Math.PI * 2;
                const far = scene === 1 ? 150 : 420;
                return (
                  <div
                    key={c}
                    className="lp-coin"
                    style={{ ["--c" as string]: c, opacity: scene === 1 ? 1 : 0, transform: `translate3d(${Math.cos(a) * far}px, ${Math.sin(a) * far * 0.8}px, ${scene === 1 ? 60 : -200}px)` }}
                  />
                );
              })}
              <Pane title="Invoice for design work" amount="3.00 USDC" sub="Pay by Friday, 6:00 PM" status={paneStatus} />
            </div>
          </div>

          <div className={`lp-copy ${scene === 0 ? "on" : ""}`}>
            <h1>Get paid in USDC, whatever chain your client is on.</h1>
            <p>Send an invoice link. Your client pays from Base, Ethereum, Arbitrum, Optimism or Polygon. You receive the exact amount on Solana.</p>
            <div className="lp-row">
              {create}
              <button type="button" className={ghost} onClick={() => { const el = story.current; if (el) window.scrollTo({ top: el.offsetTop + (el.offsetHeight - window.innerHeight) * 0.25, behavior: "smooth" }); }}>See how it works</button>
            </div>
          </div>
          <div className={`lp-copy ${scene === 1 ? "on" : ""}`}>
            <h2>Your client’s money is rarely where yours is.</h2>
            <p>Coins arrive from every direction. Your invoice stays the same.</p>
          </div>
          <div className={`lp-copy ${scene === 2 ? "on" : ""}`}>
            <h2>They pay on their chain. You get exactly what you asked for, on Solana.</h2>
          </div>
          <div className={`lp-copy ${scene === 3 ? "on" : ""}`}>
            <h2>Paid too little? Too late? Something failed?</h2>
            <p>Each case has a clear status and the money goes back to where it came from.</p>
          </div>
          <div className={`lp-copy ${scene === 4 ? "on" : ""}`}>
            <h2>Create your first invoice in under a minute.</h2>
            <div className="lp-row">{create}<Link href="/dashboard" className={ghost}>Open dashboard</Link></div>
          </div>
        </div>
      </section>

      <Link href="/dashboard" className={`${ghost} fixed bottom-5 right-5 z-30 !px-5 !py-2 text-sm backdrop-blur-xl`}>Skip to the app</Link>
      <footer className="glass mx-5 mb-10 !rounded-2xl p-5 text-center text-sm text-pearl/65">
        InvoiceAny. Invoices paid from any supported chain, settled in USDC on Solana.
      </footer>
    </>
  );
}

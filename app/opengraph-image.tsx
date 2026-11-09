import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "InvoiceAny: get paid in USDC on Solana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 90px", color: "#F4F6FF",
        background: "radial-gradient(70% 90% at 15% 10%, #2A2E73, #0B0F1E 70%)" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ fontSize: 30, opacity: 0.7 }}>InvoiceAny</div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, marginTop: 18 }}>Get paid in USDC, whatever chain your client is on.</div>
        </div>
        <div style={{ width: 280, height: 370, borderRadius: 32, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 28,
          background: "linear-gradient(145deg, rgba(255,255,255,.32), rgba(255,255,255,.06))", border: "2px solid rgba(255,255,255,.35)", boxShadow: "0 0 90px rgba(124,196,255,.4)" }}>
          <div style={{ fontSize: 46, fontWeight: 700 }}>3.00 USDC</div>
          <div style={{ fontSize: 22, opacity: 0.65, marginTop: 6 }}>Settled on Solana</div>
        </div>
      </div>
    ),
    size
  );
}

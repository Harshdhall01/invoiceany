import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import SolanaProvider from "@/components/SolanaProvider";
import Header from "@/components/Header";
import AppShell from "@/components/AppShell";

const sans = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "InvoiceAny: get paid in USDC on Solana", template: "%s | InvoiceAny" },
  description: "Send an invoice link. Your client pays from any supported chain. You receive the exact amount in USDC on Solana.",
};
export const viewport: Viewport = { themeColor: "#0B0F1E", viewportFit: "cover", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <SolanaProvider>
          <Header />
          <AppShell>{children}</AppShell>
        </SolanaProvider>
      </body>
    </html>
  );
}

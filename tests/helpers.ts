import { randomUUID } from "crypto";
import { createInvoice } from "@/lib/db";
import type { CreatePaymentInput, PaymentProvider } from "@/lib/provider";
import type { Invoice, PaymentOption } from "@/lib/types";

export const BASE_USDC: PaymentOption = { assetId: "nep141:base-usdc", chain: "base", chainLabel: "Base", symbol: "USDC", decimals: 6 };
export const ETH_USDC: PaymentOption = { assetId: "nep141:eth-usdc", chain: "eth", chainLabel: "Ethereum", symbol: "USDC", decimals: 6 };
export const GOOD_REFUND = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
export const SOL_WALLET = "11111111111111111111111111111112";

export function fakeProvider(opts: { failWith?: Error; delayMs?: number } = {}) {
  const calls = { create: 0, preview: 0, status: 0, lastInvoiceAmount: 0 };
  let n = 0;
  const provider: PaymentProvider = {
    async createDepositAddress() {
      return { address: "" };
    },
    async getPaymentStatus(invoice: Invoice) {
      calls.status++;
      // Like real Aurora: once a quote exists the provider decides the status (echo what the test set up).
      if (invoice.aurora) return { receivedAmount: invoice.receivedAmount, state: invoice.aurora.state ?? "PENDING_DEPOSIT", status: invoice.status };
      return { receivedAmount: 0, state: "awaiting-selection" };
    },
    async listPaymentOptions() {
      return [BASE_USDC, ETH_USDC];
    },
    async previewPayment(invoice, input: CreatePaymentInput) {
      calls.preview++;
      calls.lastInvoiceAmount = invoice.amountUsd;
      return {
        chain: "base", chainLabel: "Base", symbol: "USDC",
        amountInFormatted: (invoice.amountUsd + 0.34).toFixed(6), amountOutFormatted: invoice.amountUsd.toFixed(1), feeUsd: 0.34,
      };
    },
    async createPayment(invoice, input) {
      calls.create++;
      calls.lastInvoiceAmount = invoice.amountUsd;
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.failWith) throw opts.failWith;
      n++;
      return {
        depositAddress: `0xDEPOSIT${n}`,
        aurora: {
          originAssetId: input.originAssetId, originChain: "base", originSymbol: "USDC", chainLabel: "Base",
          refundAddress: input.refundAddress, deadline: new Date(Date.now() + 3600_000).toISOString(),
          correlationId: `corr-${n}`, amountIn: "10340000", amountInFormatted: "10.34", minAmountIn: "10240000",
          rawQuote: { signature: "SECRET-SIGNATURE" },
        },
      };
    },
  };
  return { provider, calls };
}

export async function makeInvoice(patch: Partial<Invoice> = {}): Promise<Invoice> {
  return createInvoice({
    id: randomUUID(), freelancerWallet: SOL_WALLET, clientName: "Acme", amountUsd: 10, description: "",
    dueDate: "2999-01-01", status: "Pending", depositAddress: "", receivedAmount: 0, createdAt: new Date().toISOString(),
    ...patch,
  });
}

let ipCounter = 0;
export const freshIp = () => `10.0.0.${++ipCounter}`;

export function post(path: string, body: unknown, ip = freshIp(), raw = false) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

import { promises as fs } from "fs";
import path from "path";
import { Keypair } from "@solana/web3.js";
import type { CreatePaymentInput, PaymentProvider } from "./index";
import type { Invoice, PaymentOption, PaymentPreview } from "../types";

const file = path.join(process.cwd(), "data", "mock-payments.json");

async function readPayments(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return {};
  }
}

/** Dev only: set the total amount "received" at a deposit address. */
export async function setMockPayment(address: string, amount: number) {
  const payments = await readPayments();
  payments[address] = amount;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(payments, null, 2));
}

// Static options so the pay-page flow works without an Aurora key.
const MOCK_OPTIONS: PaymentOption[] = [
  { assetId: "mock:usdc-base", chain: "base", chainLabel: "Base", symbol: "USDC", decimals: 6 },
  { assetId: "mock:usdc-eth", chain: "eth", chainLabel: "Ethereum", symbol: "USDC", decimals: 6 },
  { assetId: "mock:usdc-arb", chain: "arb", chainLabel: "Arbitrum", symbol: "USDC", decimals: 6 },
];

export class MockProvider implements PaymentProvider {
  async createDepositAddress() {
    // A real, valid Solana address (throwaway keypair; the secret key is discarded).
    return { address: Keypair.generate().publicKey.toBase58() };
  }

  async getPaymentStatus(invoice: { depositAddress: string }) {
    const receivedAmount = (await readPayments())[invoice.depositAddress] ?? 0;
    return {
      receivedAmount,
      state: receivedAmount > 0 ? "received" : "waiting",
      txSig: receivedAmount > 0 ? `mock-${invoice.depositAddress.slice(0, 8)}` : undefined,
    };
  }

  async listPaymentOptions() {
    return MOCK_OPTIONS;
  }

  private option(id: string): PaymentOption {
    const o = MOCK_OPTIONS.find((x) => x.assetId === id);
    if (!o) throw new Error("Unknown mock asset");
    return o;
  }

  async previewPayment(invoice: Invoice, input: CreatePaymentInput): Promise<PaymentPreview> {
    const o = this.option(input.originAssetId);
    return {
      chain: o.chain,
      chainLabel: o.chainLabel,
      symbol: o.symbol,
      amountInFormatted: invoice.amountUsd.toFixed(2),
      amountInUsd: invoice.amountUsd.toFixed(2),
      amountOutFormatted: invoice.amountUsd.toFixed(2),
      feeUsd: 0,
      timeEstimate: 30,
    };
  }

  /** The mock invoice already has its address; this only records the client's choice. */
  async createPayment(invoice: Invoice, input: CreatePaymentInput): Promise<Partial<Invoice>> {
    const o = this.option(input.originAssetId);
    return {
      aurora: {
        originAssetId: o.assetId,
        originChain: o.chain,
        originSymbol: o.symbol,
        chainLabel: o.chainLabel,
        refundAddress: input.refundAddress,
        deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
        amountIn: String(Math.round(invoice.amountUsd * 1e6)),
        amountInFormatted: invoice.amountUsd.toFixed(2),
        minAmountIn: String(Math.round(invoice.amountUsd * 1e6)),
        feeUsd: 0,
        timeEstimate: 30,
      },
    };
  }
}

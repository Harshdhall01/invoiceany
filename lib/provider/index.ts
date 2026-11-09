import type { Invoice, InvoiceStatus, PaymentOption, PaymentPreview } from "../types";
import { MockProvider } from "./mock";
import { AuroraProvider } from "./aurora";

export interface PaymentStatusResult {
  receivedAmount: number;
  state: string; // raw provider state
  txSig?: string;
  /** If set, the provider decides the invoice status itself (Aurora). Otherwise the app derives it. */
  status?: InvoiceStatus;
  /** Extra fields to persist on the invoice (e.g. Aurora details). */
  patch?: Partial<Invoice>;
}

export interface CreatePaymentInput {
  originAssetId: string;
  refundAddress: string;
}

export interface PaymentProvider {
  createDepositAddress(invoice: Omit<Invoice, "depositAddress">): Promise<{ address: string }>;
  getPaymentStatus(invoice: Invoice): Promise<PaymentStatusResult>;
  /** Assets the client may pay with (curated, and only ones the provider really supports). */
  listPaymentOptions(): Promise<PaymentOption[]>;
  /** Non-binding estimate (dry quote): what the client would send, and the fee. Creates nothing. */
  previewPayment(invoice: Invoice, input: CreatePaymentInput): Promise<PaymentPreview>;
  /** Create the real quote / deposit address for the chosen origin asset. Fields to merge into the invoice. */
  createPayment(invoice: Invoice, input: CreatePaymentInput): Promise<Partial<Invoice>>;
}

let override: PaymentProvider | null = null;
/** Tests only. */
export function __setProviderForTests(p: PaymentProvider | null) {
  override = p;
}

export function isAuroraProvider(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase() === "aurora";
}

export function getProvider(): PaymentProvider {
  if (override) return override;
  return isAuroraProvider() ? new AuroraProvider() : new MockProvider();
}

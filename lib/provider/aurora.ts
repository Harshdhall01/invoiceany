import type { Invoice, PaymentOption, PaymentPreview } from "../types";
import type { CreatePaymentInput, PaymentProvider, PaymentStatusResult } from "./index";
import { AuroraApiError, AuroraClient } from "../aurora/client";
import { loadAuroraConfig, requireDestinationAsset } from "../aurora/config";
import { getTokensCached } from "../aurora/tokens";
import { usdToBaseUnits } from "../aurora/amounts";
import { mapAuroraStatus } from "../aurora/status";
import { buildPaymentOptions, CURATED_CHAINS } from "../aurora/options";
import { effectiveDeadline, summarizeQuote } from "../aurora/quote";
import { auroraDebug } from "../aurora/debug-log";
import type { AuroraToken, QuoteResponse } from "../aurora/types";

/**
 * Aurora Intents provider (server-side only).
 * One quote per invoice => one unique deposit address per invoice.
 * The address depends on the origin chain the client picks, so it is created
 * later via createPayment(), not when the invoice is created.
 */
export class AuroraProvider implements PaymentProvider {
  private readonly cfg = loadAuroraConfig();
  private readonly destinationAssetId = requireDestinationAsset(this.cfg);
  private readonly client = new AuroraClient(this.cfg);

  async createDepositAddress(): Promise<{ address: string }> {
    return { address: "" }; // filled in by createPayment() once the client picks a chain
  }

  async listPaymentOptions(): Promise<PaymentOption[]> {
    return buildPaymentOptions(await getTokensCached(this.client), this.destinationAssetId);
  }

  /** Shared by preview (dry) and create (real). Money values come ONLY from the stored invoice. */
  private async quote(invoice: Invoice, input: CreatePaymentInput, dry: boolean) {
    if (this.cfg.AURORA_SWAP_TYPE !== "EXACT_OUTPUT") {
      throw new Error("AuroraProvider currently supports AURORA_SWAP_TYPE=EXACT_OUTPUT only");
    }
    const tokens = await getTokensCached(this.client);
    const destination = tokens.find((t) => t.assetId === this.destinationAssetId);
    const origin = tokens.find((t) => t.assetId === input.originAssetId);
    if (!destination) throw new Error("Destination asset is not in Aurora's token list; check AURORA_DESTINATION_ASSET_ID");
    if (!origin) throw new Error("Selected asset is not supported by Aurora");
    if (origin.assetId === destination.assetId) throw new Error("Origin and destination asset must differ");

    const deadline = new Date(Date.now() + this.cfg.QUOTE_DEADLINE_MINUTES * 60_000).toISOString();
    const q = await this.client.requestQuote({
      dry,
      swapType: this.cfg.AURORA_SWAP_TYPE,
      depositType: "ORIGIN_CHAIN",
      originAsset: origin.assetId,
      destinationAsset: destination.assetId,
      amount: usdToBaseUnits(invoice.amountUsd, destination.decimals), // exact USDC the freelancer receives
      slippageTolerance: this.cfg.AURORA_SLIPPAGE_BPS,
      refundTo: input.refundAddress,
      refundType: "ORIGIN_CHAIN",
      recipient: invoice.freelancerWallet,
      recipientType: "DESTINATION_CHAIN",
      ...(dry ? {} : { deadline }),
    });
    await auroraDebug(invoice.id, {
      kind: dry ? "quote-dry" : "quote",
      originAsset: origin.assetId,
      depositAddress: q.quote.depositAddress ?? null,
      response: q,
    });
    return { origin, q, deadline };
  }

  private label(origin: AuroraToken) {
    return CURATED_CHAINS.find((c) => c.slug === origin.blockchain)?.label ?? origin.blockchain;
  }

  async previewPayment(invoice: Invoice, input: CreatePaymentInput): Promise<PaymentPreview> {
    const { origin, q } = await this.quote(invoice, input, true);
    const s = summarizeQuote(q.quote);
    return {
      chain: origin.blockchain,
      chainLabel: this.label(origin),
      symbol: origin.symbol,
      amountInFormatted: s.amountInFormatted,
      amountInUsd: s.amountInUsd,
      amountOutFormatted: s.amountOutFormatted,
      feeUsd: s.feeUsd,
      timeEstimate: s.timeEstimate,
    };
  }

  async createPayment(invoice: Invoice, input: CreatePaymentInput): Promise<Partial<Invoice>> {
    const { origin, q, deadline } = await this.quote(invoice, input, false);
    const d = q.quote;
    if (!d.depositAddress) {
      throw new AuroraApiError("Aurora quote did not include a depositAddress", 200, { correlationId: q.correlationId });
    }
    const s = summarizeQuote(d);

    return {
      depositAddress: d.depositAddress,
      aurora: {
        originAssetId: origin.assetId,
        originChain: origin.blockchain,
        originSymbol: origin.symbol,
        chainLabel: this.label(origin),
        refundAddress: input.refundAddress,
        depositMemo: d.depositMemo,
        // The payment deadline is the one WE requested (Aurora echoes it in quoteRequest.deadline).
        // Aurora's quote.deadline / timeWhenInactive are exactly 72h later (observed): that is when the
        // deposit address goes inactive, not when the client should pay by. See effectiveDeadline().
        deadline: effectiveDeadline(q, deadline),
        inactiveAt: d.timeWhenInactive ?? d.deadline,
        correlationId: q.correlationId ?? null,
        quotedAt: new Date().toISOString(),
        amountIn: d.amountIn,
        amountInFormatted: d.amountInFormatted,
        amountInUsd: s.amountInUsd,
        amountOutUsd: s.amountOutUsd,
        feeUsd: s.feeUsd,
        timeEstimate: s.timeEstimate,
        withdrawFee: d.withdrawFee,
        refundFee: d.refundFee,
        minAmountIn: d.minAmountIn,
        maxAmountIn: d.maxAmountIn,
        rawQuote: q satisfies QuoteResponse,
      },
    };
  }

  async getPaymentStatus(invoice: Invoice): Promise<PaymentStatusResult> {
    // No quote yet: the client hasn't chosen a chain. Let the app derive Pending/Expired from the due date.
    if (!invoice.depositAddress || !invoice.aurora) {
      return { receivedAmount: 0, state: "awaiting-selection" };
    }

    const s = await this.client.getStatus(invoice.depositAddress, invoice.aurora.depositMemo);
    const m = mapAuroraStatus({
      rawStatus: s.status,
      swapDetails: s.swapDetails,
      quoteDeadline: invoice.aurora.deadline,
      invoiceAmountUsd: invoice.amountUsd,
    });
    const d = s.swapDetails;
    await auroraDebug(invoice.id, {
      kind: "status",
      depositAddress: invoice.depositAddress,
      rawStatus: s.status,
      mappedStatus: m.status,
      mappedLabel: m.label,
      response: s,
    });

    return {
      receivedAmount: m.receivedAmount,
      state: s.status,
      status: m.status,
      patch: {
        aurora: {
          ...invoice.aurora,
          state: s.status,
          label: m.label,
          depositedFormatted: d?.depositedAmountFormatted ?? undefined,
          refundedFormatted: d?.refundedAmountFormatted ?? undefined,
          refundReason: d?.refundReason ?? undefined,
          payoutTx: d?.destinationChainTxHashes?.[0],
        },
      },
    };
  }
}

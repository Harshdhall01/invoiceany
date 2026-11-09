import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api-error";
import { errorResponse } from "@/lib/api-error";
import { assertNotSettled, createOrReusePayment, parsePaymentRequest } from "@/lib/payments";
import { clientIp, paymentCreateLimiter } from "@/lib/rate-limit";
import { toPublicInvoice } from "@/lib/public-invoice";

export const dynamic = "force-dynamic";

// POST /api/invoices/[id]/payment  { originAssetId, refundAddress }
// Creates (or returns the existing) payment quote with its unique deposit address.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = paymentCreateLimiter().check(clientIp(req));
    if (!rl.ok) {
      const secs = Math.ceil(rl.retryAfterMs / 1000);
      throw new ApiError("RATE_LIMITED", `Too many attempts. Try again in ${secs}s.`, 429, { "Retry-After": String(secs) });
    }
    const { invoice, input } = await parsePaymentRequest(req, params.id);
    assertNotSettled(invoice);
    const result = await createOrReusePayment(invoice.id, input);
    return NextResponse.json({ invoice: toPublicInvoice(result.invoice), reused: result.reused });
  } catch (err) {
    return errorResponse(err);
  }
}

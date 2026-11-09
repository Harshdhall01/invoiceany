import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api-error";
import { assertNotOverdue, assertNotSettled, parsePaymentRequest } from "@/lib/payments";
import { getProvider } from "@/lib/provider";
import { clientIp, paymentPreviewLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/invoices/[id]/quote-preview  { originAssetId, refundAddress }
// Dry quote: shows the exact total and fee BEFORE the client commits. Creates nothing.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = paymentPreviewLimiter().check(clientIp(req));
    if (!rl.ok) {
      const secs = Math.ceil(rl.retryAfterMs / 1000);
      throw new ApiError("RATE_LIMITED", `Too many requests. Try again in ${secs}s.`, 429, { "Retry-After": String(secs) });
    }
    const { invoice, input, check } = await parsePaymentRequest(req, params.id);
    assertNotSettled(invoice);
    assertNotOverdue(invoice);
    const preview = await getProvider().previewPayment(invoice, input);
    return NextResponse.json({
      preview,
      refundAddressCheck: check.ok ? { verified: check.verified, note: check.note ?? null } : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

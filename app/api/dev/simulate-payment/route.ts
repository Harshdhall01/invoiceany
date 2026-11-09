import { NextResponse } from "next/server";
import { getInvoice } from "@/lib/db";
import { setMockPayment } from "@/lib/provider/mock";

export const dynamic = "force-dynamic";

// DEV ONLY: sets the total amount "received" for an invoice's mock deposit address.
// Body: { invoiceId: string, amount: number }   (amount 0 resets)
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" || (process.env.PAYMENT_PROVIDER ?? "mock") !== "mock") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { invoiceId, amount } = await req.json().catch(() => ({}));
  if (typeof invoiceId !== "string" || typeof amount !== "number" || amount < 0) {
    return NextResponse.json({ error: "invoiceId and amount (>= 0) required" }, { status: 400 });
  }
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await setMockPayment(invoice.depositAddress, amount);
  return NextResponse.json({ ok: true, depositAddress: invoice.depositAddress, amount });
}

import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api-error";
import { getInvoice } from "@/lib/db";
import { refreshInvoice } from "@/lib/invoices";
import { toPublicInvoice } from "@/lib/public-invoice";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const invoice = await getInvoice(params.id);
    if (!invoice) throw new ApiError("NOT_FOUND", "Invoice not found.", 404);
    return NextResponse.json(toPublicInvoice(await refreshInvoice(invoice)));
  } catch (err) {
    return errorResponse(err);
  }
}

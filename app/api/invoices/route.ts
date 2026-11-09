import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { PublicKey } from "@solana/web3.js";
import { createInvoice, listInvoicesByWallet } from "@/lib/db";
import { getProvider } from "@/lib/provider";
import { refreshInvoice } from "@/lib/invoices";
import type { Invoice } from "@/lib/types";
import { ApiError, errorResponse } from "@/lib/api-error";
import { toPublicInvoice } from "@/lib/public-invoice";

export const dynamic = "force-dynamic";

function isValidWallet(s: unknown): s is string {
  if (typeof s !== "string") return false;
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse(new ApiError("INVALID_JSON", "Request body must be valid JSON.", 400));
  }

  const { freelancerWallet, clientName, amountUsd, description, dueDate } = body ?? {};
  if (!isValidWallet(freelancerWallet))
    return errorResponse(new ApiError("INVALID_WALLET", "Invalid freelancerWallet", 400));
  if (typeof clientName !== "string" || !clientName.trim())
    return errorResponse(new ApiError("INVALID_REQUEST", "clientName is required", 400));
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0)
    return errorResponse(new ApiError("INVALID_REQUEST", "amountUsd must be a positive number", 400));
  if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
    return errorResponse(new ApiError("INVALID_REQUEST", "dueDate must be YYYY-MM-DD", 400));

  const base: Omit<Invoice, "depositAddress"> = {
    id: randomUUID(),
    freelancerWallet,
    clientName: clientName.trim(),
    amountUsd: Math.round(amountUsd * 100) / 100,
    description: typeof description === "string" ? description.trim() : "",
    dueDate,
    status: "Pending",
    receivedAmount: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    const { address } = await getProvider().createDepositAddress(base);
    const invoice = await createInvoice({ ...base, depositAddress: address });
    return NextResponse.json(toPublicInvoice(invoice), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return errorResponse(new ApiError("INVALID_REQUEST", "wallet query param required", 400));
  const list = await listInvoicesByWallet(wallet);
  // refreshInvoice skips finished Aurora swaps and throttles status calls per invoice.
  const refreshed = await Promise.all(list.map((i) => refreshInvoice(i)));
  return NextResponse.json(refreshed.map(toPublicInvoice));
}

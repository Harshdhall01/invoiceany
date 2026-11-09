import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

// Curated list of assets the client can pay with (token list itself is cached server-side ~10 min).
export async function GET() {
  try {
    return NextResponse.json({ options: await getProvider().listPaymentOptions() });
  } catch (err) {
    return errorResponse(err);
  }
}

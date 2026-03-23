import { NextResponse } from "next/server";
import { checkAndProcessPayment } from "@/lib/payment";

/**
 * Check if a pending payment has been confirmed.
 * Called by the client-side polling loop.
 *
 * GET /api/wallet/check-payment?paymentLinkId=xxx
 *
 * No auth required — the paymentLinkId is an unguessable UUID.
 * This allows both authenticated users and public payment pages to poll.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentLinkId = searchParams.get("paymentLinkId");

  if (!paymentLinkId) {
    return NextResponse.json({ error: "Missing paymentLinkId" }, { status: 400 });
  }

  try {
    const result = await checkAndProcessPayment(paymentLinkId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[PAYMENT] Check failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ confirmed: false, error: "Check failed" }, { status: 500 });
  }
}

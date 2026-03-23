import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { topUpWallet } from "@/lib/billing";
import { auditPaymentReceived } from "@/lib/audit";

/**
 * Payment received webhook (optional fallback).
 * Can be called by an external MQTT bridge if one is deployed.
 * The primary confirmation path is REST polling via /api/wallet/check-payment.
 *
 * Expected payload:
 * {
 *   transactionId: string,       // The PI / endToEndId
 *   amount: number,              // Amount in EUR
 *   notification: object         // Raw notification payload for audit
 * }
 *
 * Secured with PAYMENT_WEBHOOK_SECRET in Authorization header.
 */
export async function POST(request: Request) {
  // Validate webhook secret
  const authHeader = request.headers.get("authorization") ?? "";
  const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { transactionId, amount, notification } = body;

  if (!transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Find the payment link
  const { data: paymentLink } = await supabase
    .from("payment_links")
    .select("id, wallet_id, amount, status")
    .eq("external_transaction_id", transactionId)
    .single();

  if (!paymentLink) {
    console.error(`[PAYMENT] Unknown transaction ID: ${transactionId}`);
    return NextResponse.json({ error: "Unknown transaction" }, { status: 404 });
  }

  if (paymentLink.status === "completed") {
    return NextResponse.json({ message: "Already processed" }, { status: 200 });
  }

  // Use the amount from the payment link (not the notification) for security
  const topUpAmount = paymentLink.amount;

  // Mark payment link as completed
  await supabase
    .from("payment_links")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", paymentLink.id);

  // Top up the wallet (this triggers auto-billing)
  const result = await topUpWallet(paymentLink.wallet_id, topUpAmount, {
    type: "qr_payment",
    payment_link_id: paymentLink.id,
    transaction_id: transactionId,
    notification: notification ?? null,
  });

  if (!result.success) {
    console.error(`[PAYMENT] Top-up failed for ${transactionId}: ${result.error}`);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  auditPaymentReceived({
    walletId: paymentLink.wallet_id,
    amount: topUpAmount,
    transactionId,
  });

  console.log(`[PAYMENT] ${transactionId} → ${topUpAmount} EUR credited to wallet ${paymentLink.wallet_id}`);

  return NextResponse.json({
    message: "Payment processed",
    amount: topUpAmount,
  });
}

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicPaymentView } from "./public-payment-view";

export default async function PublicPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = getSupabaseAdmin();
  const { data: paymentLink } = await supabase
    .from("payment_links")
    .select("id, wallet_id, amount, status, payme_url, external_transaction_id, expires_at, created_at")
    .eq("id", token)
    .eq("is_public", true)
    .single();

  if (!paymentLink) notFound();

  // Get wallet owner info for display
  const { data: wallet } = await supabase
    .from("wallets")
    .select("owner_id")
    .eq("id", paymentLink.wallet_id)
    .single();

  let ownerName = "Account";
  if (wallet) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", wallet.owner_id)
      .single();

    if (profile?.full_name) ownerName = profile.full_name;
  }

  const isExpired = paymentLink.status === "expired" || new Date(paymentLink.expires_at) < new Date();
  const isCompleted = paymentLink.status === "completed";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Payment for {ownerName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isCompleted ? (
            <div className="text-center space-y-2 py-4">
              <div className="text-4xl text-green-600">&#10003;</div>
              <p className="text-lg font-semibold text-green-600">Payment Received</p>
              <p className="text-sm text-muted-foreground">
                {paymentLink.amount.toFixed(2)} EUR has been credited.
              </p>
            </div>
          ) : isExpired ? (
            <div className="text-center space-y-2 py-4">
              <Badge variant="destructive">Expired</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                This payment link has expired. Please request a new one.
              </p>
            </div>
          ) : (
            <PublicPaymentView
              paymentLinkId={paymentLink.id}
              amount={paymentLink.amount}
              paymeUrl={paymentLink.payme_url}
              transactionId={paymentLink.external_transaction_id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

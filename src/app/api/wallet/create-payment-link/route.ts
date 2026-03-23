import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPaymentLink } from "@/lib/payment";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { walletId, amount } = await request.json();

  if (!walletId || !amount || amount < 0.05 || amount > 10000) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Verify the user has access to this wallet
  const admin = getSupabaseAdmin();
  const { data: wallet } = await admin
    .from("wallets")
    .select("id, owner_id")
    .eq("id", walletId)
    .single();

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  // Check: user is wallet owner, or user is in a company under the genesis admin
  const isOwner = wallet.owner_id === user.id;
  if (!isOwner) {
    const { data: genesisCompanies } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", wallet.owner_id)
      .eq("is_genesis", true)
      .eq("status", "active");

    const companyIds = (genesisCompanies ?? []).map((m) => m.company_id);
    if (companyIds.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: userMembership } = await admin
      .from("company_memberships")
      .select("id")
      .eq("user_id", user.id)
      .in("company_id", companyIds)
      .eq("status", "active")
      .limit(1)
      .single();

    if (!userMembership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  try {
    const result = await createPaymentLink({
      walletId,
      amount,
      createdBy: user.id,
    });

    return NextResponse.json({
      paymentLinkId: result.paymentLinkId,
      transactionId: result.transactionId,
      paymeUrl: result.paymeUrl,
    });
  } catch (err) {
    console.error("[WALLET] Payment link creation failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to generate payment link" },
      { status: 500 }
    );
  }
}

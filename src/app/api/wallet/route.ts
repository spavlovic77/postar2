import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getWalletForCurrentUser } from "@/lib/dal";

// Mobile wallet summary endpoint. Mobile reads this on Account-tab load
// and after every confirmed top-up to refresh the displayed balance.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await getWalletForCurrentUser(user.id);
    if (!result) {
      // Brand-new user with no companies / no wallet yet.
      return new NextResponse(null, { status: 404 });
    }

    const [{ data: ownerProfile }, ownerAuthRes, { data: ownerCompany }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("full_name")
          .eq("id", result.genesisUserId)
          .maybeSingle(),
        admin.auth.admin.getUserById(result.genesisUserId),
        admin
          .from("company_memberships")
          .select("company:companies(price_per_document)")
          .eq("user_id", result.genesisUserId)
          .eq("is_genesis", true)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
      ]);

    const ownerEmail = ownerAuthRes?.data?.user?.email ?? null;
    const company = ownerCompany?.company as
      | { price_per_document: number | string | null }
      | null
      | undefined;
    const pricePerDocument =
      company?.price_per_document != null
        ? Number(company.price_per_document)
        : 0;

    return NextResponse.json({
      walletId: result.wallet.id,
      balance: Number(result.wallet.available_balance),
      isOwner: result.isOwner,
      ownerName: ownerProfile?.full_name ?? null,
      ownerEmail,
      pricePerDocument,
    });
  } catch (err) {
    console.error("[/api/wallet] failed:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

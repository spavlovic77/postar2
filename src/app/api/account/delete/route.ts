import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { auditAccountDeleted } from "@/lib/audit";

// App Store + Play Store both require in-app account deletion. The mobile
// client posts here with the user's Supabase access token in Authorization.
// On success, the auth.users row is gone — Supabase ON DELETE CASCADE
// handles profiles, device_tokens, department_memberships, and (importantly)
// the user's wallet. Company memberships are deactivated FIRST so audit
// history captures the lockout even if the cascade later partially fails.

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Refuse if the user has an outstanding wallet balance — cascade-deleting
  // the wallet would lose money the user is entitled to. They must drain or
  // request a refund via support first.
  const { data: wallet } = await admin
    .from("wallets")
    .select("available_balance")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (wallet && Number(wallet.available_balance) > 0) {
    return NextResponse.json(
      {
        error: "wallet_not_empty",
        message:
          "Vaša peňaženka má nenulový zostatok. Pred zrušením účtu kontaktujte podporu kvôli vráteniu prostriedkov.",
      },
      { status: 409 }
    );
  }

  // Refuse if the user is the genesis (founding) admin of any company —
  // removing them strands the company without an owner. Send to support.
  const { data: genesis } = await admin
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("is_genesis", true)
    .eq("status", "active")
    .limit(1);
  if (genesis && genesis.length > 0) {
    return NextResponse.json(
      {
        error: "genesis_admin",
        message:
          "Ste hlavným administrátorom firmy. Pred zrušením účtu kontaktujte podporu.",
      },
      { status: 409 }
    );
  }

  // Capture membership snapshot for audit before cascade deletes them.
  const { data: memberships } = await admin
    .from("company_memberships")
    .select("company_id, role")
    .eq("user_id", user.id);

  // Lock the user out first — even if the auth delete below fails, they
  // can't get back into a company inbox.
  await admin
    .from("company_memberships")
    .update({ status: "inactive" })
    .eq("user_id", user.id);

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error("[account/delete] auth.admin.deleteUser failed:", delErr);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  auditAccountDeleted({
    userId: user.id,
    email: user.email ?? "(unknown)",
    request,
    details: {
      membershipCount: memberships?.length ?? 0,
      companies: memberships?.map((m) => m.company_id) ?? [],
    },
  });

  return NextResponse.json({ ok: true });
}

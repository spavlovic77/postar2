import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { auditMembershipDeactivated } from "@/lib/audit";

// Mobile-facing membership deactivation. Mirrors deactivateMembership in
// src/lib/actions.ts but accepts a Bearer token and returns the
// machine-readable error codes the mobile maps to Slovak alerts.
//
// Genesis-admin protection is universal except for super_admins, who keep
// the support-case lever (e.g. founding admin lost access).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: membershipId } = await params;

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

  const { data: target } = await admin
    .from("company_memberships")
    .select("id, user_id, company_id, role, is_genesis, company:companies(dic)")
    .eq("id", membershipId)
    .single();
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (target.user_id === user.id) {
    return NextResponse.json(
      { error: "cannot_deactivate_self" },
      { status: 400 }
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  const isSuperAdmin = profile?.is_super_admin ?? false;

  // Genesis admins are protected from everyone EXCEPT super_admin.
  if (target.is_genesis && !isSuperAdmin) {
    return NextResponse.json(
      { error: "cannot_deactivate_genesis" },
      { status: 400 }
    );
  }

  if (!isSuperAdmin) {
    const { data: callerMembership } = await admin
      .from("company_memberships")
      .select("role, is_genesis")
      .eq("user_id", user.id)
      .eq("company_id", target.company_id)
      .eq("status", "active")
      .maybeSingle();

    const isAdmin = callerMembership?.role === "company_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    // Non-genesis admin can't deactivate other admins.
    if (target.role === "company_admin" && !callerMembership.is_genesis) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { error: updateErr } = await admin
    .from("company_memberships")
    .update({ status: "inactive" })
    .eq("id", membershipId);
  if (updateErr) {
    return NextResponse.json(
      { error: "internal", detail: updateErr.message },
      { status: 500 }
    );
  }

  // Supabase JS types the embed as either object or array depending on the
  // select form — coerce.
  const companyEmbed = target.company as
    | { dic: string | null }
    | { dic: string | null }[]
    | null;
  const dic = Array.isArray(companyEmbed)
    ? (companyEmbed[0]?.dic ?? null)
    : (companyEmbed?.dic ?? null);

  auditMembershipDeactivated({
    actorId: user.id,
    actorEmail: user.email ?? "",
    userId: target.user_id,
    companyId: target.company_id,
    companyDic: dic,
  });

  return NextResponse.json({ ok: true });
}

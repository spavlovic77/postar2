import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

const ALLOWED_ROLES = ["company_admin", "operator", "processor"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// Mobile-facing role change. Mirrors updateMemberRole in
// src/app/dashboard/companies/[id]/company-actions.ts but with the
// mobile spec's tighter permission matrix:
//   - never act on yourself
//   - never change a genesis admin's role (except super_admin)
//   - operator can only manage operator <-> processor (no admin promotion,
//     no admin demotion)
//   - non-genesis admin can't change another admin's role
//   - only genesis admin (or super_admin) can promote to company_admin
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

  const body = await request.json().catch(() => null);
  const newRole = (body && typeof body === "object" && typeof body.role === "string"
    ? body.role
    : "") as string;
  if (!ALLOWED_ROLES.includes(newRole as AllowedRole)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  const { data: target } = await admin
    .from("company_memberships")
    .select("id, user_id, company_id, role, is_genesis")
    .eq("id", membershipId)
    .single();
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (target.user_id === user.id) {
    return NextResponse.json(
      { error: "cannot_change_own_role" },
      { status: 400 }
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  const isSuperAdmin = profile?.is_super_admin ?? false;

  if (target.is_genesis && !isSuperAdmin) {
    return NextResponse.json(
      { error: "cannot_change_genesis_role" },
      { status: 400 }
    );
  }

  if (target.role === newRole) {
    return NextResponse.json({ error: "no_change" }, { status: 400 });
  }

  if (!isSuperAdmin) {
    const { data: callerMembership } = await admin
      .from("company_memberships")
      .select("role, is_genesis")
      .eq("user_id", user.id)
      .eq("company_id", target.company_id)
      .eq("status", "active")
      .maybeSingle();

    const callerRole = callerMembership?.role;
    const callerIsGenesis = callerMembership?.is_genesis ?? false;
    const isAdmin = callerRole === "company_admin";
    const isOperator = callerRole === "operator";

    if (!isAdmin && !isOperator) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (isOperator) {
      // Operators only manage operator <-> processor.
      if (target.role === "company_admin" || newRole === "company_admin") {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }
    // Only genesis admin (or super_admin) can promote to company_admin.
    if (newRole === "company_admin" && !callerIsGenesis) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    // Non-genesis admin can't change another admin's role.
    if (isAdmin && target.role === "company_admin" && !callerIsGenesis) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { error: updateErr } = await admin
    .from("company_memberships")
    .update({ role: newRole })
    .eq("id", membershipId);
  if (updateErr) {
    return NextResponse.json(
      { error: "internal", detail: updateErr.message },
      { status: 500 }
    );
  }

  audit({
    eventId: "MEMBER_ROLE_UPDATED",
    eventName: "Member role updated",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: target.company_id,
    details: {
      membershipId,
      userId: target.user_id,
      oldRole: target.role,
      newRole,
    },
  });

  return NextResponse.json({ ok: true });
}

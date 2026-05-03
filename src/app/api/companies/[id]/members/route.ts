import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Mobile-facing company member list. Mobile uses this on the per-company
// screen because the email lives in auth.users and isn't reachable via
// PostgREST embeds against profiles. Returns only ACTIVE memberships.
//
// Access: super_admin OR an active member of the same company.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

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

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    const { data: callerMembership } = await admin
      .from("company_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();
    if (!callerMembership) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  // 404 only if the company doesn't exist; an empty member list is a 200.
  const { data: company } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: memberships, error: mErr } = await admin
    .from("company_memberships")
    .select("id, user_id, role, is_genesis, profile:profiles!user_id(full_name)")
    .eq("company_id", companyId)
    .eq("status", "active");
  if (mErr) {
    return NextResponse.json(
      { error: "internal", detail: mErr.message },
      { status: 500 }
    );
  }

  // Pull emails in one batch via the admin auth API. listUsers caps at 1000
  // per page; bump to pagination if any tenant ever scales past that.
  const emailsByUserId = new Map<string, string>();
  if ((memberships ?? []).length > 0) {
    const { data: usersPage } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of usersPage?.users ?? []) {
      if (u.id && u.email) emailsByUserId.set(u.id, u.email);
    }
  }

  type MembershipRow = {
    id: string;
    user_id: string;
    role: string;
    is_genesis: boolean;
    profile:
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
  };

  const members = ((memberships ?? []) as MembershipRow[]).map((m) => {
    const fullName = Array.isArray(m.profile)
      ? (m.profile[0]?.full_name ?? null)
      : (m.profile?.full_name ?? null);
    return {
      id: m.id,
      user_id: m.user_id,
      full_name: fullName,
      email: emailsByUserId.get(m.user_id) ?? null,
      role: m.role,
      is_genesis: m.is_genesis,
    };
  });

  return NextResponse.json({ members });
}

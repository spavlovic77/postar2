import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const companyId = url.searchParams.get("company");
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

  // Get user's profile and memberships
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await admin
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  const companyIds = (memberships ?? []).map((m) => m.company_id);
  const isSuperAdmin = profile?.is_super_admin ?? false;

  let query = admin
    .from("documents")
    .select("*, company:companies(id, dic, legal_name)", { count: "exact" })
    .eq("direction", "received")
    .order("peppol_created_at", { ascending: false })
    .limit(limit);

  if (!isSuperAdmin && companyIds.length > 0) {
    query = query.in("company_id", companyIds);
  }

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  if (cursor) {
    query = query.lt("peppol_created_at", cursor);
  }

  const { data, count } = await query;

  return NextResponse.json({
    documents: data ?? [],
    total: count ?? 0,
    nextCursor:
      data && data.length === limit
        ? data[data.length - 1].peppol_created_at
        : null,
  });
}

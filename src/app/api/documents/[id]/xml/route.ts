import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: doc } = await admin
    .from("documents")
    .select("blob_url, company_id")
    .eq("id", id)
    .single();

  if (!doc?.blob_url) {
    return NextResponse.json({ error: "No document content" }, { status: 404 });
  }

  // Check access
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    const { data: membership } = await admin
      .from("company_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", doc.company_id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Fetch from blob
  const res = await fetch(doc.blob_url);
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }

  const xml = await res.text();
  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}

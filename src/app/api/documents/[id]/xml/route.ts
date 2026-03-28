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
    .select("blob_url, company_id, billed_at, status")
    .eq("id", id)
    .single();

  if (!doc?.blob_url) {
    return NextResponse.json({ error: "No document content" }, { status: 404 });
  }

  const isUnbilled = !doc.billed_at && ["new", "read", "assigned", "processed"].includes(doc.status);

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

  // Block unbilled documents for non-super-admins
  if (isUnbilled && !profile?.is_super_admin) {
    return NextResponse.json({ error: "Document is locked — insufficient wallet balance" }, { status: 403 });
  }

  try {
    // Fetch from blob with token auth
    const res = await fetch(doc.blob_url, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!res.ok) {
      console.error("Blob fetch failed:", res.status, await res.text());
      return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
    }

    const xml = await res.text();
    return new NextResponse(xml, {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (err) {
    console.error("XML fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

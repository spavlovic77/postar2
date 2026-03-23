import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getReceiveTransactionPdf, getSendTransactionPdf } from "@/lib/ion-ap";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify auth
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
    .select("ion_ap_transaction_id, direction, company_id, billed_at, status")
    .eq("id", id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Check access (super admin or company member)
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
  const isUnbilled = !doc.billed_at && ["new", "read", "assigned", "processed"].includes(doc.status);
  if (isUnbilled && !profile?.is_super_admin) {
    return NextResponse.json({ error: "Document is locked — insufficient wallet balance" }, { status: 403 });
  }

  try {
    const pdfBuffer =
      doc.direction === "received"
        ? await getReceiveTransactionPdf(doc.ion_ap_transaction_id)
        : await getSendTransactionPdf(doc.ion_ap_transaction_id);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="document-${doc.ion_ap_transaction_id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Failed to fetch PDF:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

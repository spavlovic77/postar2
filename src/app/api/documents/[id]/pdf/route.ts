import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getReceiveTransactionDocument,
  getSendTransactionPdf,
} from "@/lib/ion-ap";
import { renderInvoicePdf, type ZobrazValidation } from "@/lib/zobraz";

const BILLABLE_STATUSES = ["new", "read", "assigned", "processed"];

async function fetchPrivateBlob(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

function validationHeaders(
  v: ZobrazValidation | null | undefined
): Record<string, string> {
  if (!v) return {};
  const headers: Record<string, string> = {
    "X-Peppol-Validator-Status": v.status,
    "X-Peppol-Errors": String(v.errors),
    "X-Peppol-Warnings": String(v.warnings),
  };
  if (v.documentType) headers["X-Peppol-Document-Type"] = v.documentType;
  return headers;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Bearer (mobile) or cookie (web).
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  const admin = getSupabaseAdmin();
  let user: { id: string } | null = null;
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer);
    user = data?.user ?? null;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  }
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: doc } = await admin
    .from("documents")
    .select(
      "id, ion_ap_transaction_id, direction, company_id, billed_at, status, blob_url, pdf_blob_url, pdf_validation"
    )
    .eq("id", id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

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

  const isUnbilled =
    !doc.billed_at && BILLABLE_STATUSES.includes(doc.status);
  if (isUnbilled && !profile?.is_super_admin) {
    return NextResponse.json(
      { error: "Document is locked — insufficient wallet balance" },
      { status: 403 }
    );
  }

  // Sent docs still go through ION AP — outbound XMLs aren't in Blob yet.
  // TODO: migrate sent direction to zobraz once outbound XMLs are mirrored.
  if (doc.direction === "sent") {
    try {
      const pdfBuffer = await getSendTransactionPdf(doc.ion_ap_transaction_id);
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="document-${doc.ion_ap_transaction_id}.pdf"`,
        },
      });
    } catch (err) {
      console.error("[pdf] sent ION AP fetch failed:", err);
      return NextResponse.json(
        { error: "Failed to generate PDF" },
        { status: 500 }
      );
    }
  }

  // Received: cached PDF in Blob, else render via zobraz and cache.
  try {
    if (doc.pdf_blob_url) {
      const cached = await fetchPrivateBlob(doc.pdf_blob_url);
      return new NextResponse(cached, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="document-${doc.ion_ap_transaction_id}.pdf"`,
          ...validationHeaders(
            doc.pdf_validation as ZobrazValidation | null | undefined
          ),
        },
      });
    }

    // Cache miss — ensure XML is in Blob (self-heal legacy rows).
    let blobUrl = doc.blob_url as string | null;
    if (!blobUrl) {
      const xmlContent = await getReceiveTransactionDocument(
        doc.ion_ap_transaction_id
      );
      if (!xmlContent) {
        return NextResponse.json(
          { error: "No XML content" },
          { status: 404 }
        );
      }
      const xmlPath = `peppol/received/${doc.ion_ap_transaction_id}-${Date.now()}.xml`;
      const xmlBlob = await put(xmlPath, xmlContent, {
        contentType: "application/xml",
        access: "private",
      });
      blobUrl = xmlBlob.url;
      await admin
        .from("documents")
        .update({ blob_url: blobUrl })
        .eq("id", doc.id);
    }

    const xmlBuf = await fetchPrivateBlob(blobUrl);
    const xml = new TextDecoder("utf-8").decode(xmlBuf);
    const { pdf, validation } = await renderInvoicePdf(xml, { locale: "sk" });

    // Cache write is best-effort — we still serve the PDF on failure.
    try {
      const pdfPath = `peppol/rendered/${doc.id}.pdf`;
      const pdfBlob = await put(pdfPath, pdf, {
        contentType: "application/pdf",
        access: "private",
      });
      await admin
        .from("documents")
        .update({
          pdf_blob_url: pdfBlob.url,
          pdf_validation: validation,
        })
        .eq("id", doc.id);
    } catch (e) {
      console.warn("[pdf] cache write failed:", e);
    }

    // Buffer extends Uint8Array at runtime — NextResponse types don't list
    // it explicitly, but it's a valid BodyInit. Cast through unknown.
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="document-${doc.ion_ap_transaction_id}.pdf"`,
        ...validationHeaders(validation),
      },
    });
  } catch (err) {
    console.error("[pdf] render failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

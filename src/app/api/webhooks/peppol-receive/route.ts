import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { processDocument, retryPendingDocuments } from "@/lib/document-processor";

/**
 * Webhook called by ion-AP when a document is received.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    console.log("[WEBHOOK] Received peppol-receive webhook", { contentType });

    let transactionUrl: string | null = null;

    if (contentType.includes("x-www-form-urlencoded")) {
      const formData = await request.formData();
      transactionUrl = (formData.get("data") ?? formData.get("document") ?? formData.get("url")) as string;
      console.log("[WEBHOOK] Parsed form data", { data: formData.get("data"), document: formData.get("document"), url: formData.get("url") });
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      transactionUrl = body.data ?? body.document ?? body.url ?? null;
      console.log("[WEBHOOK] Parsed JSON body", { keys: Object.keys(body), transactionUrl: transactionUrl?.substring(0, 100) });
    } else {
      const text = await request.text();
      console.log("[WEBHOOK] Unknown content type, raw body:", text.substring(0, 200));
      if (text.includes("receive-transactions")) {
        transactionUrl = text.trim();
      } else {
        console.log("[WEBHOOK] ERROR: unsupported content type");
        return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
      }
    }

    if (!transactionUrl) {
      console.log("[WEBHOOK] ERROR: missing transaction URL");
      return NextResponse.json({ error: "Missing transaction URL" }, { status: 400 });
    }

    const idMatch = transactionUrl.match(/receive-transactions\/(\d+)/);
    if (!idMatch) {
      console.log("[WEBHOOK] ERROR: could not extract transaction ID from URL", transactionUrl);
      return NextResponse.json({ error: "Invalid transaction URL" }, { status: 400 });
    }

    const transactionId = parseInt(idMatch[1], 10);
    console.log("[WEBHOOK] Transaction ID:", transactionId);

    const supabase = getSupabaseAdmin();

    // Check for duplicate
    const { data: existing } = await supabase
      .from("documents")
      .select("id, status")
      .eq("ion_ap_transaction_id", transactionId)
      .eq("direction", "received")
      .single();

    if (existing) {
      console.log("[WEBHOOK] Duplicate transaction", { id: existing.id, status: existing.status });
      if (existing.status === "pending" || existing.status === "failed") {
        console.log("[WEBHOOK] Retrying existing document");
        await processDocument(existing.id);
      }
      return NextResponse.json({ message: "Already tracked", documentId: existing.id }, { status: 200 });
    }

    // Find company
    console.log("[WEBHOOK] Finding company for transaction", transactionId);
    let companyId: string;
    try {
      companyId = await findCompanyFromTransaction(supabase, transactionId);
      console.log("[WEBHOOK] Found company:", companyId);
    } catch (err) {
      console.error("[WEBHOOK] ERROR: could not find company", err);
      return NextResponse.json({ error: "Cannot determine receiver company" }, { status: 500 });
    }

    // Save as pending
    console.log("[WEBHOOK] Saving pending document");
    const { data: newDoc, error: insertError } = await supabase
      .from("documents")
      .insert({
        company_id: companyId,
        direction: "received",
        status: "pending",
        ion_ap_transaction_id: transactionId,
      })
      .select("id")
      .single();

    if (insertError || !newDoc) {
      console.error("[WEBHOOK] ERROR: failed to save pending document", insertError);
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
    }

    console.log("[WEBHOOK] Saved pending document:", newDoc.id);

    // Process
    console.log("[WEBHOOK] Starting document processing");
    await processDocument(newDoc.id);

    // Piggyback retry
    retryPendingDocuments().catch((err) =>
      console.error("[WEBHOOK] Background retry failed:", err)
    );

    console.log("[WEBHOOK] Done, returning 201");
    return NextResponse.json({ message: "Document received", documentId: newDoc.id }, { status: 201 });
  } catch (err) {
    console.error("[WEBHOOK] FATAL ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function findCompanyFromTransaction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  transactionId: number
): Promise<string> {
  const { getReceiveTransaction } = await import("@/lib/ion-ap");
  console.log("[WEBHOOK] Fetching transaction from ion-AP:", transactionId);
  const transaction = await getReceiveTransaction(transactionId);
  console.log("[WEBHOOK] Transaction receiver:", transaction.receiver_identifier);

  const receiverDic = transaction.receiver_identifier?.replace("0245:", "");
  console.log("[WEBHOOK] Extracted DIC:", receiverDic);

  if (receiverDic) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("dic", receiverDic)
      .single();

    if (company) {
      console.log("[WEBHOOK] Found company by DIC:", company.id);
      return company.id;
    }
    console.log("[WEBHOOK] No company found for DIC:", receiverDic);
  }

  throw new Error(`Cannot determine receiver company for identifier: ${transaction.receiver_identifier}`);
}

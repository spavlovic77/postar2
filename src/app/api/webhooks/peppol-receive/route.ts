import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { processDocument, retryPendingDocuments } from "@/lib/document-processor";

/**
 * Webhook called by ion-AP when a document is received.
 *
 * 1. Immediately save the transaction ID as a pending document
 * 2. Try to process it (fetch metadata, XML, upload blob)
 * 3. Retry any other pending documents (piggyback on traffic)
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let transactionUrl: string | null = null;

    if (contentType.includes("x-www-form-urlencoded")) {
      const formData = await request.formData();
      transactionUrl = (formData.get("data") ?? formData.get("document") ?? formData.get("url")) as string;
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      transactionUrl = body.data ?? body.document ?? body.url ?? null;
    } else {
      // Try parsing as text — might be a plain URL
      const text = await request.text();
      if (text.includes("receive-transactions")) {
        transactionUrl = text.trim();
      } else {
        return NextResponse.json(
          { error: "Unsupported content type" },
          { status: 400 }
        );
      }
    }

    if (!transactionUrl) {
      return NextResponse.json(
        { error: "Missing transaction URL" },
        { status: 400 }
      );
    }

    // Extract transaction ID from URL
    const idMatch = transactionUrl.match(/receive-transactions\/(\d+)/);
    if (!idMatch) {
      return NextResponse.json(
        { error: "Invalid transaction URL" },
        { status: 400 }
      );
    }

    const transactionId = parseInt(idMatch[1], 10);
    const supabase = getSupabaseAdmin();

    // Check for duplicate
    const { data: existing } = await supabase
      .from("documents")
      .select("id, status")
      .eq("ion_ap_transaction_id", transactionId)
      .eq("direction", "received")
      .single();

    if (existing) {
      // If pending/failed, retry it
      if (existing.status === "pending" || existing.status === "failed") {
        await processDocument(existing.id);
      }
      return NextResponse.json(
        { message: "Already tracked", documentId: existing.id },
        { status: 200 }
      );
    }

    // Step 1: Save immediately as pending (never fails)
    // Try to find company from receiver identifier pattern 0245:DIC
    // We don't have the receiver yet, so we'll use a placeholder
    // and update after processing. For now, try to extract from URL context.
    const { data: newDoc, error: insertError } = await supabase
      .from("documents")
      .insert({
        company_id: await findCompanyFromTransaction(supabase, transactionId),
        direction: "received",
        status: "pending",
        ion_ap_transaction_id: transactionId,
      })
      .select("id")
      .single();

    if (insertError || !newDoc) {
      console.error("Failed to save pending document:", insertError);
      return NextResponse.json(
        { error: "Failed to save document" },
        { status: 500 }
      );
    }

    // Step 2-5: Try to process (non-blocking for the webhook response)
    await processDocument(newDoc.id);

    // Piggyback: retry other pending documents
    retryPendingDocuments().catch((err) =>
      console.error("Background retry failed:", err)
    );

    return NextResponse.json(
      { message: "Document received", documentId: newDoc.id },
      { status: 201 }
    );
  } catch (err) {
    console.error("peppol-receive webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Try to find the company ID for a transaction.
 * We need to fetch at least minimal info from ion-AP to find the receiver.
 * If that fails, we can't save — this is the one hard failure.
 */
async function findCompanyFromTransaction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  transactionId: number
): Promise<string> {
  try {
    const { getReceiveTransaction } = await import("@/lib/ion-ap");
    const transaction = await getReceiveTransaction(transactionId);
    const receiverDic = transaction.receiver_identifier?.replace("0245:", "");

    if (receiverDic) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("dic", receiverDic)
        .single();

      if (company) return company.id;
    }
  } catch {
    // Fall through
  }

  throw new Error("Cannot determine receiver company");
}

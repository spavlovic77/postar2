import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getReceiveTransaction,
  getReceiveTransactionDocument,
} from "@/lib/ion-ap";
import { audit } from "@/lib/audit";

/**
 * Webhook called by ion-AP when a document is received.
 *
 * ion-AP sends a POST with x-www-form-urlencoded body containing
 * the API resource URL for the receive transaction.
 *
 * We fetch the transaction details and XML document from ion-AP,
 * then store it in our documents table.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let transactionUrl: string | null = null;

    if (contentType.includes("x-www-form-urlencoded")) {
      const formData = await request.formData();
      transactionUrl = formData.get("data") as string;
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      transactionUrl = body.data ?? body.url ?? null;
    } else {
      // Might receive raw XML (post_data: "document")
      // For now, we only support fetch-url-transaction
      return NextResponse.json(
        { error: "Unsupported content type" },
        { status: 400 }
      );
    }

    if (!transactionUrl) {
      return NextResponse.json(
        { error: "Missing transaction URL" },
        { status: 400 }
      );
    }

    // Extract transaction ID from URL (e.g., .../receive-transactions/123/)
    const idMatch = transactionUrl.match(/receive-transactions\/(\d+)/);
    if (!idMatch) {
      return NextResponse.json(
        { error: "Invalid transaction URL" },
        { status: 400 }
      );
    }

    const transactionId = parseInt(idMatch[1], 10);

    // Fetch transaction details from ion-AP
    const transaction = await getReceiveTransaction(transactionId);

    // Fetch the XML document
    let xmlContent: string | null = null;
    try {
      xmlContent = await getReceiveTransactionDocument(transactionId);
    } catch {
      // XML fetch may fail for some document types, continue without it
    }

    const supabase = getSupabaseAdmin();

    // Find the company by receiver identifier (0245:DIC)
    const receiverDic = transaction.receiver_identifier?.replace("0245:", "");
    let companyId: string | null = null;

    if (receiverDic) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("dic", receiverDic)
        .single();

      companyId = company?.id ?? null;
    }

    if (!companyId) {
      // Try to find by ion_ap_org_id via the receiver
      // This is a fallback — in most cases the DIC lookup will work
      console.error(
        `Could not find company for receiver: ${transaction.receiver_identifier}`
      );
      return NextResponse.json(
        { error: "Unknown receiver" },
        { status: 404 }
      );
    }

    // Check for duplicate (same ion_ap_transaction_id)
    const { data: existing } = await supabase
      .from("documents")
      .select("id")
      .eq("ion_ap_transaction_id", transactionId)
      .eq("direction", "received")
      .single();

    if (existing) {
      return NextResponse.json(
        { message: "Already processed" },
        { status: 200 }
      );
    }

    // Store the document
    const { error: insertError } = await supabase.from("documents").insert({
      company_id: companyId,
      direction: "received",
      status: "new",
      ion_ap_transaction_id: transactionId,
      transaction_uuid: transaction.transaction_id,
      document_type: transaction.document_element,
      document_id: transaction.document_id,
      sender_identifier: transaction.sender_identifier,
      receiver_identifier: transaction.receiver_identifier,
      xml_content: xmlContent,
      peppol_created_at: transaction.created_on,
    });

    if (insertError) {
      console.error("Failed to store document:", insertError);
      return NextResponse.json(
        { error: "Failed to store document" },
        { status: 500 }
      );
    }

    audit({
      eventId: "PEPPOL_DOCUMENT_RECEIVED",
      eventName: "Peppol document received",
      companyId,
      companyDic: receiverDic ?? undefined,
      details: {
        transactionId,
        documentType: transaction.document_element,
        documentId: transaction.document_id,
        senderIdentifier: transaction.sender_identifier,
      },
    });

    return NextResponse.json(
      { message: "Document stored", transactionId },
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

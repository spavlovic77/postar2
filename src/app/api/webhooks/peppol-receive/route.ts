import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
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
 * store the XML in Vercel Blob, and save metadata in Supabase.
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

    // Extract transaction ID from URL
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

    // Fetch the XML document and store in Vercel Blob
    let blobUrl: string | null = null;
    try {
      const xmlContent = await getReceiveTransactionDocument(transactionId);
      if (xmlContent) {
        const filename = `peppol/received/${transactionId}-${transaction.document_element ?? "document"}-${Date.now()}.xml`;
        const blob = await put(filename, xmlContent, {
          contentType: "application/xml",
          access: "public",
        });
        blobUrl = blob.url;
      }
    } catch (err) {
      console.error("Failed to fetch/store XML document:", err);
      // Continue without XML — metadata is still valuable
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
      console.error(
        `Could not find company for receiver: ${transaction.receiver_identifier}`
      );
      return NextResponse.json(
        { error: "Unknown receiver" },
        { status: 404 }
      );
    }

    // Check for duplicate
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
      blob_url: blobUrl,
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
        blobUrl,
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

import { put } from "@vercel/blob";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getReceiveTransaction,
  getReceiveTransactionDocument,
} from "@/lib/ion-ap";
import { audit } from "@/lib/audit";

const MAX_RETRIES = 10;

/**
 * Process a pending document: fetch metadata + XML from ion-AP,
 * upload XML to Vercel Blob, update document record.
 *
 * Returns true if successful, false if failed.
 */
export async function processDocument(documentId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (!doc) return false;

  // Don't process if already completed or max retries exceeded
  if (["new", "read", "assigned", "processed"].includes(doc.status)) {
    return true;
  }

  if (doc.retry_count >= MAX_RETRIES) {
    await supabase
      .from("documents")
      .update({
        status: "failed",
        last_error: `Max retries (${MAX_RETRIES}) exceeded`,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    audit({
      eventId: "DOCUMENT_PROCESSING_FAILED",
      eventName: "Document processing failed (max retries)",
      severity: "error",
      companyId: doc.company_id,
      details: {
        documentId,
        transactionId: doc.ion_ap_transaction_id,
        retryCount: doc.retry_count,
      },
    });

    return false;
  }

  // Mark as processing
  await supabase
    .from("documents")
    .update({ status: "processing" })
    .eq("id", documentId);

  try {
    // Step 2: Fetch transaction metadata
    const transaction = await getReceiveTransaction(doc.ion_ap_transaction_id);

    // Step 3: Fetch XML document
    let blobUrl = doc.blob_url;
    if (!blobUrl) {
      const xmlContent = await getReceiveTransactionDocument(doc.ion_ap_transaction_id);
      if (xmlContent) {
        // Step 4: Upload to Vercel Blob
        const filename = `peppol/received/${doc.ion_ap_transaction_id}-${transaction.document_element ?? "document"}-${Date.now()}.xml`;
        const blob = await put(filename, xmlContent, {
          contentType: "application/xml",
          access: "public",
        });
        blobUrl = blob.url;
      }
    }

    // Step 5: Update document record with full data
    await supabase
      .from("documents")
      .update({
        status: "new",
        transaction_uuid: transaction.transaction_id,
        document_type: transaction.document_element,
        document_id: transaction.document_id,
        sender_identifier: transaction.sender_identifier,
        receiver_identifier: transaction.receiver_identifier,
        blob_url: blobUrl,
        peppol_created_at: transaction.created_on,
        last_error: null,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    // Find company DIC for audit
    const { data: company } = await supabase
      .from("companies")
      .select("dic")
      .eq("id", doc.company_id)
      .single();

    audit({
      eventId: "PEPPOL_DOCUMENT_RECEIVED",
      eventName: "Peppol document received",
      companyId: doc.company_id,
      companyDic: company?.dic ?? undefined,
      details: {
        transactionId: doc.ion_ap_transaction_id,
        documentType: transaction.document_element,
        documentId: transaction.document_id,
        senderIdentifier: transaction.sender_identifier,
        blobUrl,
        retryCount: doc.retry_count,
      },
    });

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await supabase
      .from("documents")
      .update({
        status: "pending",
        retry_count: doc.retry_count + 1,
        last_error: errorMessage,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    audit({
      eventId: "DOCUMENT_PROCESSING_RETRY",
      eventName: "Document processing failed, will retry",
      severity: "warning",
      companyId: doc.company_id,
      details: {
        documentId,
        transactionId: doc.ion_ap_transaction_id,
        retryCount: doc.retry_count + 1,
        error: errorMessage,
      },
    });

    return false;
  }
}

/**
 * Retry all pending documents (retry_count < MAX_RETRIES).
 * Returns count of successfully processed documents.
 */
export async function retryPendingDocuments(): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data: pending } = await supabase
    .from("documents")
    .select("id")
    .eq("status", "pending")
    .lt("retry_count", MAX_RETRIES)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!pending || pending.length === 0) return 0;

  let processed = 0;
  for (const doc of pending) {
    const success = await processDocument(doc.id);
    if (success) processed++;
  }

  return processed;
}

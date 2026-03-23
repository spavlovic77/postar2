import { put } from "@vercel/blob";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseUblMetadata } from "@/lib/ubl-parser";
import {
  getReceiveTransaction,
  getReceiveTransactionDocument,
} from "@/lib/ion-ap";
import { audit } from "@/lib/audit";

const MAX_RETRIES = 10;

function log(documentId: string, step: string, detail?: any) {
  console.log(`[DOC ${documentId}] ${step}`, detail ?? "");
}

/**
 * Process a pending document: fetch metadata + XML from ion-AP,
 * upload XML to Vercel Blob, update document record.
 *
 * Returns true if successful, false if failed.
 */
export async function processDocument(documentId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  log(documentId, "START processing");

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (fetchError || !doc) {
    log(documentId, "ERROR: document not found", fetchError?.message);
    return false;
  }

  log(documentId, "STATUS", { status: doc.status, retryCount: doc.retry_count, transactionId: doc.ion_ap_transaction_id });

  // Don't process if already completed or max retries exceeded
  if (["new", "read", "assigned", "processed"].includes(doc.status)) {
    log(documentId, "SKIP: already completed", doc.status);
    return true;
  }

  if (doc.retry_count >= MAX_RETRIES) {
    log(documentId, "FAIL: max retries exceeded", doc.retry_count);
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
      details: { documentId, transactionId: doc.ion_ap_transaction_id, retryCount: doc.retry_count },
    });

    return false;
  }

  // Mark as processing
  log(documentId, "STEP 1: marking as processing");
  await supabase
    .from("documents")
    .update({ status: "processing", last_retry_at: new Date().toISOString() })
    .eq("id", documentId);

  try {
    // Step 2: Fetch transaction metadata
    log(documentId, "STEP 2: fetching transaction metadata from ion-AP", { transactionId: doc.ion_ap_transaction_id });
    const startMeta = Date.now();
    const transaction = await getReceiveTransaction(doc.ion_ap_transaction_id);
    log(documentId, "STEP 2: done", {
      ms: Date.now() - startMeta,
      sender: transaction.sender_identifier,
      receiver: transaction.receiver_identifier,
      docType: transaction.document_element,
      docId: transaction.document_id,
    });

    // Step 3: Fetch XML document
    let blobUrl = doc.blob_url;
    let metadata = doc.metadata ?? {};

    if (!blobUrl) {
      log(documentId, "STEP 3: fetching XML document from ion-AP");
      const startXml = Date.now();
      const xmlContent = await getReceiveTransactionDocument(doc.ion_ap_transaction_id);
      log(documentId, "STEP 3: done", { ms: Date.now() - startXml, xmlLength: xmlContent?.length ?? 0 });

      if (xmlContent) {
        // Step 4: Upload to Vercel Blob
        log(documentId, "STEP 4: uploading to Vercel Blob");
        const startBlob = Date.now();
        const filename = `peppol/received/${doc.ion_ap_transaction_id}-${transaction.document_element ?? "document"}-${Date.now()}.xml`;
        const blob = await put(filename, xmlContent, {
          contentType: "application/xml",
          access: "private",
        });
        blobUrl = blob.url;
        log(documentId, "STEP 4: done", { ms: Date.now() - startBlob, blobUrl });

        // Step 4b: Parse UBL metadata
        log(documentId, "STEP 4b: parsing UBL metadata");
        const startParse = Date.now();
        metadata = parseUblMetadata(xmlContent);
        log(documentId, "STEP 4b: done", {
          ms: Date.now() - startParse,
          supplier: metadata.supplierName,
          amount: metadata.totalAmount,
          lineItems: metadata.lineItems?.length ?? 0,
        });
      } else {
        log(documentId, "STEP 3: WARNING - empty XML content");
      }
    } else {
      log(documentId, "STEP 3: SKIP - blob already exists", blobUrl);
    }

    // Step 5: Update document record with full data
    log(documentId, "STEP 5: updating document record");
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "new",
        transaction_uuid: transaction.transaction_id,
        document_type: transaction.document_element,
        document_id: transaction.document_id,
        sender_identifier: transaction.sender_identifier,
        receiver_identifier: transaction.receiver_identifier,
        metadata,
        blob_url: blobUrl,
        peppol_created_at: transaction.created_on,
        last_error: null,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      log(documentId, "STEP 5: ERROR updating document", updateError.message);
      throw new Error(`DB update failed: ${updateError.message}`);
    }

    log(documentId, "COMPLETE: document processed successfully");

    // Audit
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
        metadata: { supplier: metadata.supplierName, amount: metadata.totalAmount },
      },
    });

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(documentId, "ERROR: processing failed", { error: errorMessage, retryCount: doc.retry_count + 1 });

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

  // Recover stuck "processing" documents (stuck > 2 minutes)
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: stuckProcessing } = await supabase
    .from("documents")
    .update({ status: "pending" })
    .eq("status", "processing")
    .lt("last_retry_at", twoMinAgo)
    .select("id");

  if (stuckProcessing && stuckProcessing.length > 0) {
    console.log(`[CRON] Recovered ${stuckProcessing.length} stuck processing documents`);
  }

  // Also recover processing docs with no last_retry_at
  const { data: stuckNoRetry } = await supabase
    .from("documents")
    .update({ status: "pending" })
    .eq("status", "processing")
    .is("last_retry_at", null)
    .select("id");

  if (stuckNoRetry && stuckNoRetry.length > 0) {
    console.log(`[CRON] Recovered ${stuckNoRetry.length} stuck processing documents (no retry timestamp)`);
  }

  const { data: pending } = await supabase
    .from("documents")
    .select("id")
    .eq("status", "pending")
    .lt("retry_count", MAX_RETRIES)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!pending || pending.length === 0) {
    console.log("[CRON] No pending documents to retry");
    return 0;
  }

  console.log(`[CRON] Retrying ${pending.length} pending documents`);

  let processed = 0;
  for (const doc of pending) {
    const success = await processDocument(doc.id);
    if (success) processed++;
  }

  console.log(`[CRON] Retry complete: ${processed}/${pending.length} succeeded`);
  return processed;
}

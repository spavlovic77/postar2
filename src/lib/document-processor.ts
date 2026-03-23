import { put } from "@vercel/blob";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseUblMetadata } from "@/lib/ubl-parser";
import {
  getReceiveTransaction,
  getReceiveTransactionDocument,
} from "@/lib/ion-ap";
import { audit } from "@/lib/audit";

const MAX_RETRIES = 10;

export async function processDocument(documentId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const startTime = Date.now();

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (fetchError || !doc) {
    console.error(`[DOC ${documentId}] Not found:`, fetchError?.message);
    return false;
  }

  if (["new", "read", "assigned", "processed"].includes(doc.status)) return true;

  if (doc.retry_count >= MAX_RETRIES) {
    console.error(`[DOC ${documentId}] Max retries exceeded (${MAX_RETRIES})`);
    await supabase.from("documents").update({
      status: "failed",
      last_error: `Max retries (${MAX_RETRIES}) exceeded`,
      last_retry_at: new Date().toISOString(),
    }).eq("id", documentId);

    audit({
      eventId: "DOCUMENT_PROCESSING_FAILED",
      eventName: "Document processing failed (max retries)",
      severity: "error",
      companyId: doc.company_id,
      details: { documentId, transactionId: doc.ion_ap_transaction_id, retryCount: doc.retry_count },
    });
    return false;
  }

  await supabase.from("documents").update({
    status: "processing",
    last_retry_at: new Date().toISOString(),
  }).eq("id", documentId);

  try {
    const transaction = await getReceiveTransaction(doc.ion_ap_transaction_id);

    let blobUrl = doc.blob_url;
    let metadata = doc.metadata ?? {};
    if (!blobUrl) {
      const xmlContent = await getReceiveTransactionDocument(doc.ion_ap_transaction_id);
      if (xmlContent) {
        const filename = `peppol/received/${doc.ion_ap_transaction_id}-${transaction.document_element ?? "document"}-${Date.now()}.xml`;
        const blob = await put(filename, xmlContent, {
          contentType: "application/xml",
          access: "private",
        });
        blobUrl = blob.url;
        metadata = parseUblMetadata(xmlContent);
      }
    }

    const { error: updateError } = await supabase.from("documents").update({
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
    }).eq("id", documentId);

    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    const ms = Date.now() - startTime;
    console.log(`[DOC ${documentId}] OK: ${metadata.supplierName ?? transaction.sender_identifier}, ${metadata.totalAmount ?? "?"} ${metadata.currency ?? ""}, ${metadata.lineItems?.length ?? 0} items (${ms}ms)`);

    const { data: company } = await supabase.from("companies").select("dic").eq("id", doc.company_id).single();

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
        metadata: { supplier: metadata.supplierName, amount: metadata.totalAmount, currency: metadata.currency },
      },
    });

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const ms = Date.now() - startTime;
    console.error(`[DOC ${documentId}] FAIL (retry ${doc.retry_count + 1}/${MAX_RETRIES}, ${ms}ms): ${errorMessage}`);

    await supabase.from("documents").update({
      status: "pending",
      retry_count: doc.retry_count + 1,
      last_error: errorMessage,
      last_retry_at: new Date().toISOString(),
    }).eq("id", documentId);

    audit({
      eventId: "DOCUMENT_PROCESSING_RETRY",
      eventName: "Document processing failed, will retry",
      severity: "warning",
      companyId: doc.company_id,
      details: { documentId, transactionId: doc.ion_ap_transaction_id, retryCount: doc.retry_count + 1, error: errorMessage },
    });

    return false;
  }
}

export async function retryPendingDocuments(): Promise<number> {
  const supabase = getSupabaseAdmin();

  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await supabase.from("documents").update({ status: "pending" }).eq("status", "processing").lt("last_retry_at", twoMinAgo);
  await supabase.from("documents").update({ status: "pending" }).eq("status", "processing").is("last_retry_at", null);

  const { data: pending } = await supabase
    .from("documents")
    .select("id")
    .eq("status", "pending")
    .lt("retry_count", MAX_RETRIES)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!pending || pending.length === 0) return 0;

  console.log(`[CRON] Retrying ${pending.length} pending documents`);
  let processed = 0;
  for (const doc of pending) {
    if (await processDocument(doc.id)) processed++;
  }
  console.log(`[CRON] Done: ${processed}/${pending.length} succeeded`);
  return processed;
}

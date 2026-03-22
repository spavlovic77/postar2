import { NextResponse } from "next/server";
import { retryPendingDocuments } from "@/lib/document-processor";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

/**
 * Vercel Cron Job — runs every 5 minutes.
 *
 * 1. Retry pending documents (max 20 per run)
 * 2. Ensure next month's audit log partition exists
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // 1. Retry pending documents
  try {
    const processed = await retryPendingDocuments();
    results.documentsRetried = processed;

    if (processed > 0) {
      audit({
        eventId: "CRON_DOCUMENTS_RETRIED",
        eventName: "Cron retried pending documents",
        details: { processedCount: processed },
      });
    }
  } catch (err) {
    console.error("Cron: document retry failed:", err);
    results.documentsError = err instanceof Error ? err.message : String(err);
  }

  // 2. Ensure audit log partitions exist (current + next 2 months)
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();

    for (let i = 0; i <= 2; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() + i);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const { error } = await supabase.rpc("create_audit_partition", { month_str: monthStr });
      if (error && !error.message?.includes("already exists")) {
        console.error(`Failed to create partition ${monthStr}:`, error);
      }
    }

    // Archive partitions older than 6 months
    const archiveDate = new Date(now);
    archiveDate.setMonth(archiveDate.getMonth() - 6);
    const archiveMonth = `${archiveDate.getFullYear()}-${String(archiveDate.getMonth() + 1).padStart(2, "0")}`;

    const { data: archiveResult, error: archiveError } = await supabase
      .rpc("archive_audit_partition", { month_str: archiveMonth });

    if (archiveResult && !archiveError) {
      results.auditArchived = archiveResult;
      audit({
        eventId: "CRON_AUDIT_ARCHIVED",
        eventName: "Cron archived audit partition",
        details: { archivedTable: archiveResult },
      });
    }

    results.auditPartitions = "ok";
  } catch (err) {
    // Partition management errors are non-fatal
    results.auditPartitionsError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({ ok: true, ...results });
}

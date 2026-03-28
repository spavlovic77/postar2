import { NextResponse } from "next/server";
import { retryPendingDocuments } from "@/lib/document-processor";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { ensureCompanyActivated } from "@/lib/ion-ap/activate";
import { autoBillUnbilledDocuments } from "@/lib/billing";

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

  // 3. Check pending payment links via KVERKOM REST API (safety net)
  try {
    const supabase = getSupabaseAdmin();

    // Find pending payment links that are not yet expired
    const { data: pendingLinks } = await supabase
      .from("payment_links")
      .select("id")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .limit(10);

    if (pendingLinks && pendingLinks.length > 0) {
      const { checkAndProcessPayment } = await import("@/lib/payment");
      let confirmed = 0;

      for (const link of pendingLinks) {
        try {
          const result = await checkAndProcessPayment(link.id);
          if (result.confirmed) confirmed++;
        } catch {
          // Non-fatal: individual check failure
        }
      }

      if (confirmed > 0) {
        results.paymentsConfirmed = confirmed;
        audit({
          eventId: "CRON_PAYMENTS_CONFIRMED",
          eventName: "Cron confirmed pending payments via REST",
          details: { confirmedCount: confirmed, checkedCount: pendingLinks.length },
        });
      }
    }

    // Expire stale payment links (older than 24h, still pending)
    const { data: expired } = await supabase
      .from("payment_links")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (expired && expired.length > 0) {
      results.paymentLinksExpired = expired.length;
    }
  } catch (err) {
    results.paymentLinksError = err instanceof Error ? err.message : String(err);
  }

  // 4. Auto-heal: retry failed Peppol activations
  try {
    const supabase = getSupabaseAdmin();
    const { data: errorCompanies } = await supabase
      .from("companies")
      .select("id, dic")
      .eq("ion_ap_status", "error")
      .eq("status", "active")
      .limit(5);

    if (errorCompanies && errorCompanies.length > 0) {
      let healed = 0;
      for (const company of errorCompanies) {
        try {
          await ensureCompanyActivated(company.id);
          healed++;
        } catch {
          // Will retry next cycle
        }
      }
      if (healed > 0) {
        results.activationsHealed = healed;
        audit({
          eventId: "CRON_ACTIVATIONS_HEALED",
          eventName: "Cron auto-healed failed activations",
          details: { healedCount: healed, attemptedCount: errorCompanies.length },
        });
      }
    }
  } catch (err) {
    results.activationsHealError = err instanceof Error ? err.message : String(err);
  }

  // 5. Auto-heal: retry billing for wallets with sufficient balance
  try {
    const supabase = getSupabaseAdmin();

    // Find wallets that have unbilled documents
    const { data: walletsWithUnbilled } = await supabase
      .from("wallets")
      .select("id")
      .gt("available_balance", 0)
      .limit(10);

    if (walletsWithUnbilled && walletsWithUnbilled.length > 0) {
      let billed = 0;
      for (const w of walletsWithUnbilled) {
        try {
          const result = await autoBillUnbilledDocuments(w.id);
          billed += result.billed;
        } catch {
          // Non-fatal
        }
      }
      if (billed > 0) {
        results.documentsAutoBilled = billed;
        audit({
          eventId: "CRON_BILLING_HEALED",
          eventName: "Cron auto-billed documents",
          details: { billedCount: billed },
        });
      }
    }
  } catch (err) {
    results.billingHealError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({ ok: true, ...results });
}

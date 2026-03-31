"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ensureCompanyActivated } from "@/lib/ion-ap/activate";
import { processDocument } from "@/lib/document-processor";
import { autoBillUnbilledDocuments, topUpWallet, getWalletForCompany } from "@/lib/billing";
import { audit } from "@/lib/audit";

async function getOpsUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  return { user, isSuperAdmin: profile?.is_super_admin ?? false, admin };
}

async function verifyOpsAccess(companyId?: string) {
  const { user, isSuperAdmin, admin } = await getOpsUser();
  if (isSuperAdmin) return { user, admin, isSuperAdmin };

  if (companyId) {
    const { data: membership } = await admin
      .from("company_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("status", "active")
      .single();

    if (membership?.role === "company_admin") return { user, admin, isSuperAdmin };
  }

  throw new Error("Insufficient permissions for operations");
}

// ============================================================
// Companies & Activation
// ============================================================

export async function opsRetryActivation(companyId: string) {
  const { user, admin } = await verifyOpsAccess(companyId);

  try {
    await ensureCompanyActivated(companyId);

    audit({
      eventId: "OPS_ACTIVATION_RETRIED",
      eventName: "Operator retried Peppol activation",
      severity: "warning",
      actorId: user.id,
      actorEmail: user.email ?? undefined,
      companyId,
    });

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Activation failed" };
  }
}

export async function opsGetCompaniesWithIssues() {
  const { admin, isSuperAdmin, user } = await getOpsUser();

  let query = admin
    .from("companies")
    .select("id, dic, legal_name, ion_ap_status, ion_ap_error, status, deactivated_at, created_at")
    .in("ion_ap_status", ["error", "pending"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (!isSuperAdmin) {
    const { data: memberships } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    const companyIds = (memberships ?? []).map((m) => m.company_id);
    if (companyIds.length === 0) return [];
    query = query.in("id", companyIds);
  }

  const { data } = await query;
  return data ?? [];
}

// ============================================================
// Documents
// ============================================================

export async function opsRetryDocument(documentId: string) {
  const admin = getSupabaseAdmin();
  const { data: doc } = await admin
    .from("documents")
    .select("company_id, status, retry_count")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "Document not found" };

  const { user } = await verifyOpsAccess(doc.company_id);

  // Reset retry count and status to allow reprocessing
  await admin.from("documents").update({
    status: "pending",
    retry_count: 0,
    last_error: null,
  }).eq("id", documentId);

  const success = await processDocument(documentId);

  audit({
    eventId: "OPS_DOCUMENT_RETRIED",
    eventName: "Operator retried document processing",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: doc.company_id,
    details: { documentId, previousStatus: doc.status, previousRetryCount: doc.retry_count },
  });

  return success ? { success: true } : { error: "Processing failed — check document detail for error" };
}

export async function opsRetryAllFailedDocuments() {
  const { user, admin, isSuperAdmin } = await getOpsUser();

  let query = admin
    .from("documents")
    .select("id, company_id")
    .eq("status", "failed")
    .limit(50);

  if (!isSuperAdmin) {
    const { data: memberships } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    const companyIds = (memberships ?? []).map((m) => m.company_id);
    if (companyIds.length === 0) return { retried: 0, succeeded: 0 };
    query = query.in("company_id", companyIds);
  }

  const { data: docs } = await query;
  if (!docs || docs.length === 0) return { retried: 0, succeeded: 0 };

  let succeeded = 0;
  for (const doc of docs) {
    await admin.from("documents").update({
      status: "pending",
      retry_count: 0,
      last_error: null,
    }).eq("id", doc.id);

    if (await processDocument(doc.id)) succeeded++;
  }

  audit({
    eventId: "OPS_DOCUMENTS_BULK_RETRIED",
    eventName: "Operator bulk retried failed documents",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { totalRetried: docs.length, succeeded },
  });

  return { retried: docs.length, succeeded };
}

export async function opsForceDocumentStatus(documentId: string, newStatus: string) {
  const admin = getSupabaseAdmin();
  const { data: doc } = await admin
    .from("documents")
    .select("company_id, status")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "Document not found" };

  const { user } = await verifyOpsAccess(doc.company_id);

  await admin.from("documents").update({ status: newStatus, last_error: null }).eq("id", documentId);

  audit({
    eventId: "OPS_DOCUMENT_STATUS_FORCED",
    eventName: "Operator forced document status change",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: doc.company_id,
    details: { documentId, fromStatus: doc.status, toStatus: newStatus },
  });

  return { success: true };
}

export async function opsGetFailedDocuments() {
  const { admin, isSuperAdmin, user } = await getOpsUser();

  let query = admin
    .from("documents")
    .select("id, company_id, status, document_type, document_id, sender_identifier, retry_count, last_error, last_retry_at, created_at, ion_ap_transaction_id")
    .in("status", ["failed", "pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (!isSuperAdmin) {
    const { data: memberships } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    const companyIds = (memberships ?? []).map((m) => m.company_id);
    if (companyIds.length === 0) return [];
    query = query.in("company_id", companyIds);
  }

  const { data } = await query;
  return data ?? [];
}

// ============================================================
// Payments
// ============================================================

export async function opsForceCheckPayment(paymentLinkId: string) {
  const { user } = await getOpsUser();

  const { checkAndProcessPayment } = await import("@/lib/payment");
  const result = await checkAndProcessPayment(paymentLinkId);

  audit({
    eventId: "OPS_PAYMENT_FORCE_CHECKED",
    eventName: "Operator force-checked payment status",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { paymentLinkId, confirmed: result.confirmed },
  });

  return result;
}

export async function opsMarkPaymentCompleted(paymentLinkId: string) {
  const { user, admin, isSuperAdmin } = await getOpsUser();
  if (!isSuperAdmin) return { error: "Only super admins can manually mark payments" };

  const { data: link } = await admin
    .from("payment_links")
    .select("id, wallet_id, amount, status, external_transaction_id")
    .eq("id", paymentLinkId)
    .single();

  if (!link) return { error: "Payment link not found" };
  if (link.status === "completed") return { error: "Already completed" };

  await admin.from("payment_links").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", paymentLinkId);

  const topUpResult = await topUpWallet(link.wallet_id, link.amount, {
    type: "manual_override",
    payment_link_id: link.id,
    transaction_id: link.external_transaction_id,
    overridden_by: user.id,
  }, user.id);

  audit({
    eventId: "OPS_PAYMENT_MANUALLY_COMPLETED",
    eventName: "Super admin manually completed payment",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { paymentLinkId, amount: link.amount, walletId: link.wallet_id },
  });

  return topUpResult.success
    ? { success: true, amount: link.amount }
    : { error: topUpResult.error };
}

export async function opsGetPendingPayments() {
  const { admin, isSuperAdmin, user } = await getOpsUser();

  let query = admin
    .from("payment_links")
    .select("id, wallet_id, amount, status, external_transaction_id, payme_url, created_at, expires_at, completed_at")
    .in("status", ["pending", "expired"])
    .order("created_at", { ascending: false })
    .limit(50);

  // Non-super-admins can only see their own wallet's payments
  if (!isSuperAdmin) {
    const { data: wallet } = await admin
      .from("wallets")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!wallet) return [];
    query = query.eq("wallet_id", wallet.id);
  }

  const { data } = await query;
  return data ?? [];
}

// ============================================================
// Billing
// ============================================================

export async function opsRetryAutoBill(walletId: string) {
  const { user } = await getOpsUser();

  const result = await autoBillUnbilledDocuments(walletId);

  audit({
    eventId: "OPS_AUTOBILL_RETRIED",
    eventName: "Operator retried auto-billing",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { walletId, billed: result.billed, totalCost: result.totalCost },
  });

  return { success: true, billed: result.billed, totalCost: result.totalCost };
}

export async function opsForceBillDocument(documentId: string) {
  const { user, admin, isSuperAdmin } = await getOpsUser();
  if (!isSuperAdmin) return { error: "Only super admins can force-bill" };

  const { data: doc } = await admin
    .from("documents")
    .select("company_id, billed_at, status")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "Document not found" };
  if (doc.billed_at) return { error: "Already billed" };

  await admin.from("documents").update({
    billed_at: new Date().toISOString(),
  }).eq("id", documentId);

  audit({
    eventId: "OPS_DOCUMENT_FORCE_BILLED",
    eventName: "Super admin force-billed document (no charge)",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: doc.company_id,
    details: { documentId },
  });

  return { success: true };
}

export async function opsGetUnbilledSummary() {
  const { admin, isSuperAdmin, user } = await getOpsUser();

  let companyFilter: string[] | undefined;
  if (!isSuperAdmin) {
    const { data: memberships } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    companyFilter = (memberships ?? []).map((m) => m.company_id);
    if (companyFilter.length === 0) return [];
  }

  let query = admin
    .from("documents")
    .select("company_id, id")
    .is("billed_at", null)
    .in("status", ["new", "read", "assigned", "processed"]);

  if (companyFilter) query = query.in("company_id", companyFilter);

  const { data: docs } = await query;
  if (!docs || docs.length === 0) return [];

  // Group by company
  const byCompany = new Map<string, number>();
  for (const d of docs) {
    byCompany.set(d.company_id, (byCompany.get(d.company_id) ?? 0) + 1);
  }

  // Fetch company details + pricing + wallet balance
  const companyIds = Array.from(byCompany.keys());
  const { data: companies } = await admin
    .from("companies")
    .select("id, dic, legal_name, price_per_document")
    .in("id", companyIds);

  const results = [];
  for (const company of companies ?? []) {
    const count = byCompany.get(company.id) ?? 0;
    const price = company.price_per_document ?? 0;
    const totalCost = Math.round(count * price * 10000) / 10000;

    // Get wallet balance
    const walletData = await getWalletForCompany(company.id);
    const balance = walletData?.wallet.available_balance ?? 0;
    const walletId = walletData?.wallet.id ?? null;

    results.push({
      companyId: company.id,
      dic: company.dic,
      legalName: company.legal_name,
      unbilledCount: count,
      pricePerDoc: price,
      totalCost,
      walletBalance: balance,
      walletId,
      canBill: balance >= totalCost || price <= 0,
    });
  }

  return results;
}

// ============================================================
// Invitations
// ============================================================

export async function opsExtendInvitation(invitationId: string) {
  const { user, admin } = await getOpsUser();

  const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error } = await admin
    .from("invitations")
    .update({ expires_at: newExpiry })
    .eq("id", invitationId)
    .is("accepted_at", null);

  if (error) return { error: "Failed to extend invitation" };

  audit({
    eventId: "OPS_INVITATION_EXTENDED",
    eventName: "Operator extended invitation expiry",
    severity: "info",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { invitationId, newExpiry },
  });

  return { success: true };
}

export async function opsGetPendingInvitations() {
  const { admin, isSuperAdmin, user } = await getOpsUser();

  let query = admin
    .from("invitations")
    .select("id, email, roles, company_ids, is_genesis, expires_at, created_at, invited_by")
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!isSuperAdmin) {
    const { data: memberships } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    const companyIds = (memberships ?? []).map((m) => m.company_id);
    if (companyIds.length === 0) return [];
    query = query.overlaps("company_ids", companyIds);
  }

  const { data } = await query;
  return data ?? [];
}

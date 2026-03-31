"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTestInvoicesToCompany } from "@/lib/test-invoices";
import { audit } from "@/lib/audit";

export async function sendTestInvoices(companyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();

  // Check permission: must be company admin (genesis or regular) or super admin
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    const { data: membership } = await admin
      .from("company_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("status", "active")
      .single();

    if (membership?.role !== "company_admin") {
      return { error: "Only company admins can send test invoices" };
    }
  }

  // Fetch company
  const { data: company } = await admin
    .from("companies")
    .select("dic, legal_name, ion_ap_status")
    .eq("id", companyId)
    .single();

  if (!company) return { error: "Company not found" };
  if (company.ion_ap_status !== "active") {
    return { error: "Company must be active on Peppol to receive test invoices" };
  }

  // Check env var
  if (!process.env.ION_AP_TEST_SENDER_TOKEN) {
    return { error: "Test invoice sending is not configured" };
  }

  try {
    const result = await sendTestInvoicesToCompany(
      company.dic,
      company.legal_name ?? `Company ${company.dic}`
    );

    audit({
      eventId: "TEST_INVOICES_SENT",
      eventName: "Test invoices sent to company",
      actorId: user.id,
      actorEmail: user.email ?? undefined,
      companyId,
      companyDic: company.dic,
      details: { sent: result.sent, errors: result.errors },
    });

    if (result.errors.length > 0) {
      return {
        error: `Sent ${result.sent}/3 invoices. Errors: ${result.errors.join("; ")}`,
      };
    }

    return { success: true, sent: result.sent };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send test invoices";
    return { error: message };
  }
}

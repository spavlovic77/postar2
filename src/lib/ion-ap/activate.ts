import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createOrganization, createIdentifier } from "./client";
import { audit } from "@/lib/audit";

/**
 * Lazily activate a company on ion-AP.
 *
 * Creates the organization and identifier on ion-AP if not already active.
 * Called before the first send or receive operation for a company.
 *
 * Returns the ion-AP org ID, or throws if activation fails.
 */
export async function ensureCompanyActivated(companyId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company) throw new Error(`Company ${companyId} not found`);

  // Already active
  if (company.ion_ap_status === "active" && company.ion_ap_org_id) {
    return company.ion_ap_org_id;
  }

  try {
    // 1. Create organization on ion-AP
    const org = await createOrganization({
      name: company.legal_name ?? `Company ${company.dic}`,
      country: "SK",
      publishInSmp: true,
      reference: company.dic,
    });

    // 2. Create identifier (0245:DIC)
    const identifier = await createIdentifier(org.id, {
      identifier: `0245:${company.dic}`,
      verified: true,
      publishReceivePeppolbis: true,
    });

    // 3. Update company record
    await supabase
      .from("companies")
      .update({
        ion_ap_org_id: org.id,
        ion_ap_identifier_id: identifier.id,
        ion_ap_status: "active",
        ion_ap_error: null,
        ion_ap_activated_at: new Date().toISOString(),
      })
      .eq("id", companyId);

    audit({
      eventId: "PEPPOL_COMPANY_ACTIVATED",
      eventName: "Company activated on Peppol network",
      companyId,
      companyDic: company.dic,
      details: {
        ionApOrgId: org.id,
        ionApIdentifierId: identifier.id,
        peppolIdentifier: `0245:${company.dic}`,
      },
    });

    return org.id;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Store error for visibility
    await supabase
      .from("companies")
      .update({
        ion_ap_status: "error",
        ion_ap_error: errorMessage,
      })
      .eq("id", companyId);

    audit({
      eventId: "PEPPOL_ACTIVATION_FAILED",
      eventName: "Company Peppol activation failed",
      severity: "error",
      companyId,
      companyDic: company.dic,
      details: { error: errorMessage },
    });

    throw new Error(`Failed to activate company on Peppol: ${errorMessage}`);
  }
}

/**
 * Get the Peppol identifier for a company (0245:DIC).
 */
export function getPeppolIdentifier(dic: string): string {
  return `0245:${dic}`;
}

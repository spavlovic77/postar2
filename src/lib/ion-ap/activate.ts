import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createOrganization,
  createIdentifier,
  createReceiveTrigger,
  createReceiveTriggerOption,
} from "./client";
import { audit } from "@/lib/audit";

interface ActivationOverrides {
  legalName?: string;
  companyEmail?: string;
}

/**
 * Activate a company on ion-AP.
 *
 * Creates the organization, identifier, and receive trigger.
 * Uses the most recent verification_token as ion-AP reference.
 *
 * Returns the ion-AP org ID, or throws if activation fails.
 */
export async function ensureCompanyActivated(
  companyId: string,
  overrides?: ActivationOverrides
): Promise<number> {
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

  // Get most recent verification_token for this DIC
  const { data: latestVerification } = await supabase
    .from("pfs_verifications")
    .select("verification_token")
    .eq("dic", company.dic)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const reference = latestVerification?.verification_token ?? company.dic;
  const orgName = overrides?.legalName ?? company.legal_name ?? `Company ${company.dic}`;

  try {
    // 1. Create organization on ion-AP
    const org = await createOrganization({
      name: orgName,
      country: "SK",
      publishInSmp: true,
      reference,
    });

    // 2. Create identifier (0245:DIC)
    const identifier = await createIdentifier(org.id, {
      identifier: `0245:${company.dic}`,
      verified: true,
      publishReceivePeppolbis: true,
    });

    // 3. Set up receive trigger (webhook to Postar)
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.peppolbox.sk"}/api/webhooks/peppol-receive`;

    const trigger = await createReceiveTrigger(org.id, {
      name: "Forward to Postar",
      triggerType: "API_CALL",
      enabled: true,
    });

    await createReceiveTriggerOption(org.id, trigger.id, {
      name: "url",
      value: webhookUrl,
    });
    await createReceiveTriggerOption(org.id, trigger.id, {
      name: "method",
      value: "POST",
    });
    await createReceiveTriggerOption(org.id, trigger.id, {
      name: "post_data",
      value: "fetch-url-transaction",
    });
    await createReceiveTriggerOption(org.id, trigger.id, {
      name: "post_field_name",
      value: "data",
    });

    // 4. Update company record
    const companyUpdates: Record<string, unknown> = {
      ion_ap_org_id: org.id,
      ion_ap_identifier_id: identifier.id,
      ion_ap_status: "active",
      ion_ap_error: null,
      ion_ap_activated_at: new Date().toISOString(),
      status: "active",
      deactivated_at: null,
    };

    // Apply overrides to company record
    if (overrides?.legalName) companyUpdates.legal_name = overrides.legalName;
    if (overrides?.companyEmail) companyUpdates.company_email = overrides.companyEmail;

    await supabase.from("companies").update(companyUpdates).eq("id", companyId);

    audit({
      eventId: "PEPPOL_COMPANY_ACTIVATED",
      eventName: "Company activated on Peppol network",
      companyId,
      companyDic: company.dic,
      details: {
        ionApOrgId: org.id,
        ionApIdentifierId: identifier.id,
        peppolIdentifier: `0245:${company.dic}`,
        reference,
        reactivation: company.status === "deactivated",
      },
    });

    return org.id;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

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

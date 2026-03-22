"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ensureCompanyActivated } from "@/lib/ion-ap";
import { createInvitation, getInviteUrl } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/email";
import { audit, auditInvitationCreated } from "@/lib/audit";

export async function reactivateCompany(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();

  // Super admin only
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: "Only super admins can reactivate companies" };
  }

  const companyId = formData.get("companyId") as string;
  const legalName = formData.get("legalName") as string;
  const genesisEmail = formData.get("genesisEmail") as string;
  const companyEmail = formData.get("companyEmail") as string;

  if (!companyId || !genesisEmail) {
    return { error: "Company ID and genesis admin email are required" };
  }

  const { data: company } = await admin
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company) return { error: "Company not found" };

  // 1. Reactivate on ion-AP (creates org + identifier + receive trigger)
  try {
    await ensureCompanyActivated(companyId, {
      legalName: legalName || undefined,
      companyEmail: companyEmail || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Activation failed";
    revalidatePath(`/dashboard/companies/${companyId}`);
    return { error: message };
  }

  // 2. Send genesis admin invitation
  try {
    const result = await createInvitation(admin, {
      email: genesisEmail,
      role: "company_admin",
      companyIds: [companyId],
      isGenesis: true,
      invitedBy: user.id,
    });

    if (result && !result.alreadyExists) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://postar2.vercel.app";

      await sendInvitationEmail({
        to: genesisEmail,
        inviteUrl: getInviteUrl(result.token, baseUrl),
        role: "company_admin",
        companyNames: [legalName || company.legal_name || company.dic],
      });

      auditInvitationCreated({
        actorId: user.id,
        actorEmail: user.email,
        inviteeEmail: genesisEmail,
        role: "company_admin",
        companyId,
        companyDic: company.dic,
        isGenesis: true,
      });
    }
  } catch (err) {
    // Company is already activated, invitation failure is non-fatal
    console.error("Failed to send genesis invitation:", err);
  }

  audit({
    eventId: "COMPANY_REACTIVATED",
    eventName: "Company reactivated by super admin",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId,
    companyDic: company.dic,
    details: {
      genesisEmail,
      legalName: legalName || company.legal_name,
    },
  });

  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${companyId}`);
  return { success: true };
}

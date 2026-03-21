"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendReonboardingEmail } from "@/lib/email";
import { audit } from "@/lib/audit";

export async function sendReonboardingRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();

  // Super admin only
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin, pfs_activation_link")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: "Only super admins can send re-onboarding requests" };
  }

  if (!profile.pfs_activation_link) {
    return { error: "PFS activation link is not configured. Set it in Settings first." };
  }

  const companyId = formData.get("companyId") as string;
  const recipientEmail = formData.get("recipientEmail") as string;

  if (!companyId || !recipientEmail) {
    return { error: "Company ID and recipient email are required" };
  }

  const { data: company } = await admin
    .from("companies")
    .select("dic, legal_name")
    .eq("id", companyId)
    .single();

  if (!company) return { error: "Company not found" };

  try {
    await sendReonboardingEmail({
      to: recipientEmail,
      companyName: company.legal_name ?? company.dic,
      activationLink: profile.pfs_activation_link,
    });

    audit({
      eventId: "REONBOARDING_REQUEST_SENT",
      eventName: "Re-onboarding request sent",
      actorId: user.id,
      actorEmail: user.email ?? undefined,
      companyId,
      companyDic: company.dic,
      details: {
        recipientEmail,
        activationLink: profile.pfs_activation_link,
      },
    });

    revalidatePath(`/dashboard/companies/${companyId}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to send re-onboarding email:", err);
    return { error: "Failed to send email" };
  }
}

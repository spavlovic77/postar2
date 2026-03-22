"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendOnboardingEmail } from "@/lib/email";
import { getPfsActivationLink } from "@/lib/settings";
import { audit } from "@/lib/audit";

export async function sendOnboardingRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: "Only super admins can send onboarding requests" };
  }

  const activationLink = await getPfsActivationLink();
  if (!activationLink) {
    return { error: "PFS activation link is not configured. Set it in System Settings first." };
  }

  const recipientEmail = formData.get("recipientEmail") as string;
  const companyName = (formData.get("companyName") as string) || null;

  if (!recipientEmail) {
    return { error: "Email is required" };
  }

  try {
    await sendOnboardingEmail({
      to: recipientEmail,
      companyName,
      activationLink,
    });

    audit({
      eventId: "ONBOARDING_REQUEST_SENT",
      eventName: "Onboarding request sent to new customer",
      actorId: user.id,
      actorEmail: user.email ?? undefined,
      details: { recipientEmail, companyName, activationLink },
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to send onboarding email:", err);
    return { error: "Failed to send email" };
  }
}

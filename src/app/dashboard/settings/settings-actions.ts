"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { updateSetting, invalidateSettingsCache } from "@/lib/settings";
import { audit } from "@/lib/audit";

const ALLOWED_KEYS = [
  "resend_from_email",
  "pfs_webhook_secret",
  "pfs_activation_link",
  "ion_ap_base_url",
  "ion_ap_api_token",
  "twilio_phone_number",
];

export async function updateSystemSettings(formData: FormData) {
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
    return { error: "Only super admins can update system settings" };
  }

  const changes: Record<string, string> = {};

  for (const key of ALLOWED_KEYS) {
    const value = formData.get(key) as string;
    if (value !== null && value !== undefined) {
      await updateSetting(key, value, user.id);
      changes[key] = key.includes("secret") || key.includes("token") ? "***" : value;
    }
  }

  invalidateSettingsCache();

  audit({
    eventId: "SYSTEM_SETTINGS_UPDATED",
    eventName: "System settings updated",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: changes,
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}

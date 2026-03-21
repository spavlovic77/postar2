"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export async function updatePfsActivationLink(formData: FormData) {
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
    return { error: "Only super admins can update this setting" };
  }

  const pfsLink = (formData.get("pfsLink") as string) || null;

  await admin
    .from("profiles")
    .update({ pfs_activation_link: pfsLink })
    .eq("id", user.id);

  audit({
    eventId: "PFS_LINK_UPDATED",
    eventName: "PFS activation link updated",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { pfsActivationLink: pfsLink },
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}

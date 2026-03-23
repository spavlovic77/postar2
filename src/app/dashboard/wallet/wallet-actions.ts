"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { adjustWallet } from "@/lib/billing";

export async function adjustWalletAction(
  walletId: string,
  amount: number,
  description: string
): Promise<{ success?: boolean; error?: string }> {
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
    return { error: "Only super admins can adjust wallet balances" };
  }

  return adjustWallet(walletId, amount, description, user.id);
}

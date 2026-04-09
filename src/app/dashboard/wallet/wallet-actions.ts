"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { adjustWallet } from "@/lib/billing";
import { audit } from "@/lib/audit";

const MIN_REFUND_AMOUNT = 5.0;
// Basic IBAN format check: 2 country letters + 2 check digits + up to 30 alphanumeric characters
const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

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

/**
 * Issue a refund of the entire wallet balance to a customer's IBAN.
 * Per VOP only available when:
 *  - super admin acts
 *  - wallet balance is >= 5.00 EUR
 *  - the genesis admin has NO active companies (account closure scenario)
 *
 * The actual SEPA transfer is performed manually by the super admin
 * outside the application. This action only records the obligation
 * and decrements the wallet balance.
 */
export async function issueRefund(
  walletId: string,
  iban: string,
  note: string
): Promise<{ success?: boolean; error?: string; refundedAmount?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();

  // 1. Permission check
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: "Only super admins can issue refunds" };
  }

  // 2. Validate inputs
  const cleanIban = iban.replace(/\s+/g, "").toUpperCase();
  if (!IBAN_REGEX.test(cleanIban)) {
    return { error: "Invalid IBAN format" };
  }
  if (!note.trim()) {
    return { error: "Note is required" };
  }

  // 3. Load wallet
  const { data: wallet } = await admin
    .from("wallets")
    .select("id, owner_id, available_balance")
    .eq("id", walletId)
    .single();

  if (!wallet) return { error: "Wallet not found" };

  // 4. Eligibility: balance >= minimum
  const balance = Number(wallet.available_balance);
  if (balance < MIN_REFUND_AMOUNT) {
    return {
      error: `Minimum refundable balance is ${MIN_REFUND_AMOUNT.toFixed(2)} EUR (current: ${balance.toFixed(2)} EUR)`,
    };
  }

  // 5. Eligibility: no active genesis memberships (account fully closed)
  const { data: activeMemberships } = await admin
    .from("company_memberships")
    .select("id")
    .eq("user_id", wallet.owner_id)
    .eq("is_genesis", true)
    .eq("status", "active")
    .limit(1);

  if (activeMemberships && activeMemberships.length > 0) {
    return {
      error: "Refund can only be issued after all companies under this wallet have been deactivated",
    };
  }

  // 6. Atomic deduction via RPC (race-condition safe)
  const { data: newBalance, error: deductError } = await admin.rpc("wallet_deduct", {
    p_wallet_id: walletId,
    p_amount: balance,
  });

  if (deductError || newBalance === null || newBalance < 0) {
    return { error: "Failed to deduct refund amount from wallet" };
  }

  // 7. Record refund transaction
  await admin.from("wallet_transactions").insert({
    wallet_id: walletId,
    type: "refund",
    amount: -balance,
    balance_after: newBalance,
    description: `Refund to IBAN ${cleanIban}: ${note.trim()}`,
    metadata: { iban: cleanIban, note: note.trim() },
    created_by: user.id,
  });

  // 8. Audit
  audit({
    eventId: "WALLET_REFUNDED",
    eventName: "Wallet refunded to customer",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: {
      walletId,
      ownerId: wallet.owner_id,
      iban: cleanIban,
      amount: balance,
      note: note.trim(),
    },
  });

  revalidatePath(`/dashboard/wallet/${walletId}`);
  return { success: true, refundedAmount: balance };
}

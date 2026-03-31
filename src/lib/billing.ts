import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import type { Wallet, WalletTransaction } from "@/lib/types";

// ============================================================
// Wallet resolution
// ============================================================

/**
 * Get or auto-create a wallet for a genesis admin.
 */
export async function getOrCreateWallet(genesisUserId: string): Promise<Wallet> {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("wallets")
    .select("*")
    .eq("owner_id", genesisUserId)
    .single();

  if (existing) return existing as Wallet;

  const { data: created, error } = await supabase
    .from("wallets")
    .insert({ owner_id: genesisUserId })
    .select("*")
    .single();

  if (error) {
    // Race condition: another request created it
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("wallets")
        .select("*")
        .eq("owner_id", genesisUserId)
        .single();
      if (retry) return retry as Wallet;
    }
    throw new Error(`Failed to create wallet: ${error.message}`);
  }

  return created as Wallet;
}

/**
 * Find the genesis admin's wallet for a given company.
 * Returns null if no genesis admin exists for the company.
 */
export async function getWalletForCompany(
  companyId: string
): Promise<{ wallet: Wallet; genesisUserId: string } | null> {
  const supabase = getSupabaseAdmin();

  const { data: genesisMembership } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("is_genesis", true)
    .eq("status", "active")
    .single();

  if (!genesisMembership) return null;

  const wallet = await getOrCreateWallet(genesisMembership.user_id);
  return { wallet, genesisUserId: genesisMembership.user_id };
}

/**
 * Find the wallet for the current user.
 * If the user is a genesis admin, return their wallet.
 * Otherwise, find the genesis admin of their first company.
 */
export async function getWalletForUser(
  userId: string
): Promise<{ wallet: Wallet; genesisUserId: string } | null> {
  const supabase = getSupabaseAdmin();

  // Check if user is a genesis admin themselves
  const { data: genesisMembership } = await supabase
    .from("company_memberships")
    .select("user_id, company_id")
    .eq("user_id", userId)
    .eq("is_genesis", true)
    .eq("status", "active")
    .limit(1)
    .single();

  if (genesisMembership) {
    const wallet = await getOrCreateWallet(userId);
    return { wallet, genesisUserId: userId };
  }

  // Find genesis admin of user's first company
  const { data: membership } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) return null;

  return getWalletForCompany(membership.company_id);
}

// ============================================================
// Atomic wallet helpers (race-condition safe)
// ============================================================

/**
 * Atomically deduct from wallet using SQL-level arithmetic.
 * Returns the new balance, or null if insufficient funds.
 */
async function atomicDeduct(
  walletId: string,
  amount: number
): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("wallet_deduct", {
    p_wallet_id: walletId,
    p_amount: amount,
  });
  if (error || data === null || data < 0) return null;
  return data as number;
}

/**
 * Atomically add to wallet using SQL-level arithmetic.
 * Returns the new balance.
 */
async function atomicCredit(
  walletId: string,
  amount: number
): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("wallet_credit", {
    p_wallet_id: walletId,
    p_amount: amount,
  });
  if (error || data === null) return null;
  return data as number;
}

// ============================================================
// Billing
// ============================================================

/**
 * Charge for a processed document. Returns true if billed, false if insufficient balance.
 * If price_per_document is null or 0, the document is auto-billed for free.
 */
export async function chargeForDocument(
  documentId: string,
  companyId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // Get company pricing
  const { data: company } = await supabase
    .from("companies")
    .select("price_per_document, dic")
    .eq("id", companyId)
    .single();

  const price = company?.price_per_document ?? 0;

  // Free document — mark as billed immediately
  if (price <= 0) {
    await supabase
      .from("documents")
      .update({ billed_at: new Date().toISOString() })
      .eq("id", documentId);
    return true;
  }

  // Find genesis admin's wallet
  const walletInfo = await getWalletForCompany(companyId);
  if (!walletInfo) {
    console.warn(`[BILLING] No genesis admin found for company ${companyId}, document ${documentId} left unbilled`);
    return false;
  }

  const { wallet } = walletInfo;

  // Atomic deduction via RPC — no read-then-write race
  const newBalance = await atomicDeduct(wallet.id, price);
  if (newBalance === null) {
    return false;
  }

  // Record transaction
  const { data: txn } = await supabase
    .from("wallet_transactions")
    .insert({
      wallet_id: wallet.id,
      company_id: companyId,
      document_id: documentId,
      type: "charge",
      amount: -price,
      balance_after: newBalance,
      description: `Document charge`,
    })
    .select("id")
    .single();

  // Mark document as billed
  await supabase
    .from("documents")
    .update({
      billed_at: new Date().toISOString(),
      wallet_transaction_id: txn?.id ?? null,
    })
    .eq("id", documentId);

  audit({
    eventId: "DOCUMENT_CHARGED",
    eventName: "Document charged to wallet",
    companyId,
    companyDic: company?.dic ?? undefined,
    details: { documentId, price, balanceAfter: newBalance },
  });

  return true;
}

// ============================================================
// Top-up and auto-billing
// ============================================================

/**
 * Add funds to a wallet and trigger auto-billing of unbilled documents.
 */
export async function topUpWallet(
  walletId: string,
  amount: number,
  metadata: Record<string, unknown> = {},
  createdBy?: string
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: false, error: "Amount must be positive" };

  const supabase = getSupabaseAdmin();

  // Atomic credit via RPC
  const newBalance = await atomicCredit(walletId, amount);
  if (newBalance === null) {
    return { success: false, error: "Wallet not found or credit failed" };
  }

  // Get owner for audit
  const { data: wallet } = await supabase
    .from("wallets")
    .select("owner_id")
    .eq("id", walletId)
    .single();

  // Record transaction
  await supabase.from("wallet_transactions").insert({
    wallet_id: walletId,
    type: "top_up",
    amount,
    balance_after: newBalance,
    description: "Wallet top-up",
    metadata,
    created_by: createdBy ?? null,
  });

  audit({
    eventId: "WALLET_TOPPED_UP",
    eventName: "Wallet topped up",
    actorId: createdBy ?? wallet?.owner_id,
    details: { walletId, amount, balanceAfter: newBalance, ...metadata },
  });

  // Auto-bill unbilled documents
  await autoBillUnbilledDocuments(walletId);

  return { success: true };
}

/**
 * All-or-nothing: bill all unbilled documents if wallet has sufficient balance.
 * Returns count of billed documents.
 */
export async function autoBillUnbilledDocuments(
  walletId: string
): Promise<{ billed: number; totalCost: number }> {
  const supabase = getSupabaseAdmin();

  // Get wallet with owner
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, owner_id, available_balance")
    .eq("id", walletId)
    .single();

  if (!wallet) return { billed: 0, totalCost: 0 };

  // Find all companies where this wallet owner is genesis admin
  const { data: genesisMemberships } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", wallet.owner_id)
    .eq("is_genesis", true)
    .eq("status", "active");

  const companyIds = (genesisMemberships ?? []).map((m) => m.company_id);
  if (companyIds.length === 0) return { billed: 0, totalCost: 0 };

  // Get company pricing
  const { data: companies } = await supabase
    .from("companies")
    .select("id, price_per_document, dic")
    .in("id", companyIds);

  const priceMap: Record<string, number> = {};
  for (const c of companies ?? []) {
    priceMap[c.id] = c.price_per_document ?? 0;
  }

  // Fetch all unbilled documents
  const { data: unbilledDocs } = await supabase
    .from("documents")
    .select("id, company_id")
    .in("company_id", companyIds)
    .is("billed_at", null)
    .in("status", ["new", "read", "assigned", "processed"])
    .order("peppol_created_at", { ascending: true });

  if (!unbilledDocs || unbilledDocs.length === 0) return { billed: 0, totalCost: 0 };

  // Calculate total cost (excluding free documents)
  let totalCost = 0;
  const chargeableDocs: { id: string; companyId: string; price: number }[] = [];
  const freeDocs: string[] = [];

  for (const doc of unbilledDocs) {
    const price = priceMap[doc.company_id] ?? 0;
    if (price <= 0) {
      freeDocs.push(doc.id);
    } else {
      totalCost += price;
      chargeableDocs.push({ id: doc.id, companyId: doc.company_id, price });
    }
  }

  // Bill free docs immediately
  if (freeDocs.length > 0) {
    await supabase
      .from("documents")
      .update({ billed_at: new Date().toISOString() })
      .in("id", freeDocs);
  }

  // All-or-nothing check for chargeable docs
  if (chargeableDocs.length === 0) return { billed: freeDocs.length, totalCost: 0 };

  // Atomic deduction via RPC
  const newBalance = await atomicDeduct(walletId, totalCost);
  if (newBalance === null) {
    console.log(`[BILLING] Auto-bill skipped: insufficient balance for total cost ${totalCost} across ${chargeableDocs.length} docs`);
    return { billed: freeDocs.length, totalCost };
  }

  let runningBalance = newBalance + totalCost; // pre-deduction balance

  // Create transactions and mark documents as billed
  for (const doc of chargeableDocs) {
    runningBalance -= doc.price;

    const { data: txn } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: walletId,
        company_id: doc.companyId,
        document_id: doc.id,
        type: "charge",
        amount: -doc.price,
        balance_after: runningBalance,
        description: "Document charge (auto-billed)",
      })
      .select("id")
      .single();

    await supabase
      .from("documents")
      .update({
        billed_at: new Date().toISOString(),
        wallet_transaction_id: txn?.id ?? null,
      })
      .eq("id", doc.id);
  }

  const totalBilled = freeDocs.length + chargeableDocs.length;

  audit({
    eventId: "AUTO_BILL_COMPLETED",
    eventName: "Auto-billing completed after top-up",
    details: {
      walletId,
      documentsBilled: totalBilled,
      totalCost,
      balanceAfter: newBalance,
    },
  });

  console.log(`[BILLING] Auto-billed ${totalBilled} documents, cost ${totalCost}, balance ${newBalance}`);

  return { billed: totalBilled, totalCost };
}

// ============================================================
// Super admin wallet adjustment
// ============================================================

/**
 * Manually adjust a wallet balance (super admin only).
 * Amount can be positive (credit) or negative (debit).
 */
export async function adjustWallet(
  walletId: string,
  amount: number,
  description: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  if (amount === 0) return { success: false, error: "Amount cannot be zero" };

  const supabase = getSupabaseAdmin();

  let newBalance: number | null;
  if (amount > 0) {
    newBalance = await atomicCredit(walletId, amount);
  } else {
    newBalance = await atomicDeduct(walletId, Math.abs(amount));
  }

  if (newBalance === null) {
    return { success: false, error: amount < 0 ? "Insufficient balance for adjustment" : "Wallet not found" };
  }

  await supabase.from("wallet_transactions").insert({
    wallet_id: walletId,
    type: "adjustment",
    amount,
    balance_after: newBalance,
    description,
    created_by: actorId,
  });

  audit({
    eventId: "WALLET_ADJUSTED",
    eventName: "Wallet balance adjusted by admin",
    severity: "warning",
    actorId,
    details: { walletId, amount, balanceAfter: newBalance, description },
  });

  // If positive adjustment, try auto-billing
  if (amount > 0) {
    await autoBillUnbilledDocuments(walletId);
  }

  return { success: true };
}

// ============================================================
// Statement / history
// ============================================================

export async function getWalletTransactions(params: {
  walletId: string;
  companyId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ transactions: WalletTransaction[]; total: number }> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("wallet_transactions")
    .select("*", { count: "exact" })
    .eq("wallet_id", params.walletId)
    .order("created_at", { ascending: false });

  if (params.companyId) query = query.eq("company_id", params.companyId);
  if (params.type) query = query.eq("type", params.type);
  if (params.dateFrom) query = query.gte("created_at", params.dateFrom);
  if (params.dateTo) query = query.lte("created_at", `${params.dateTo}T23:59:59`);

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count } = await query;
  return { transactions: (data ?? []) as WalletTransaction[], total: count ?? 0 };
}

/**
 * Get count of unbilled documents for companies under a genesis admin's wallet.
 */
export async function getUnbilledCount(walletOwnerId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data: genesisMemberships } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", walletOwnerId)
    .eq("is_genesis", true)
    .eq("status", "active");

  const companyIds = (genesisMemberships ?? []).map((m) => m.company_id);
  if (companyIds.length === 0) return 0;

  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .in("company_id", companyIds)
    .is("billed_at", null)
    .in("status", ["new", "read", "assigned", "processed"]);

  return count ?? 0;
}

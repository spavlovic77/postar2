import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getWalletTransactions } from "@/lib/billing";

/**
 * GET /api/wallet/statement?walletId=xxx&companyId=xxx&dateFrom=2026-01&dateTo=2026-03
 *
 * Returns a CSV statement of wallet transactions filtered by company and date range.
 * Only accessible by genesis admin (wallet owner) or super admin.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const walletId = searchParams.get("walletId");
  const companyId = searchParams.get("companyId") || undefined;
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;

  if (!walletId) {
    return NextResponse.json({ error: "Missing walletId" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Verify access: wallet owner or super admin
  const { data: wallet } = await admin
    .from("wallets")
    .select("id, owner_id")
    .eq("id", walletId)
    .single();

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (wallet.owner_id !== user.id && !profile?.is_super_admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Get company name for the statement header
  let companyName = "All Companies";
  if (companyId) {
    const { data: company } = await admin
      .from("companies")
      .select("legal_name, dic")
      .eq("id", companyId)
      .single();
    if (company) {
      companyName = company.legal_name ?? company.dic;
    }
  }

  // Fetch all transactions (no pagination for export)
  const { transactions } = await getWalletTransactions({
    walletId,
    companyId,
    dateFrom,
    dateTo,
    limit: 10000,
    offset: 0,
  });

  // Build CSV
  const header = "Date,Type,Description,Company,Amount (EUR),Balance After (EUR)";
  const rows = transactions.map((txn) => {
    const date = new Date(txn.created_at).toISOString().slice(0, 19).replace("T", " ");
    const type = txn.type.replace("_", " ");
    const desc = (txn.description ?? "").replace(/"/g, '""');
    const company = txn.company_id ?? "";
    const amount = txn.amount.toFixed(4);
    const balance = txn.balance_after.toFixed(4);
    return `${date},"${type}","${desc}",${company},${amount},${balance}`;
  });

  // Summary
  const totalCharges = transactions
    .filter((t) => t.type === "charge")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalTopUps = transactions
    .filter((t) => t.type === "top_up")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalAdjustments = transactions
    .filter((t) => t.type === "adjustment")
    .reduce((sum, t) => sum + t.amount, 0);
  const documentCount = transactions.filter((t) => t.type === "charge").length;

  const summary = [
    "",
    "Summary",
    `"Total documents charged",${documentCount}`,
    `"Total charges (EUR)",${totalCharges.toFixed(4)}`,
    `"Total top-ups (EUR)",${totalTopUps.toFixed(4)}`,
    `"Total adjustments (EUR)",${totalAdjustments.toFixed(4)}`,
  ];

  const csv = [header, ...rows, ...summary].join("\n");

  const period = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : "all";
  const filename = `statement_${companyName.replace(/[^a-zA-Z0-9]/g, "_")}_${period}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

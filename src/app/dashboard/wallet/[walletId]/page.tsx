export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { getUserWithRole } from "@/lib/dal";
import { getWalletTransactions, getUnbilledCount } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionHistory } from "../transaction-history";
import { AdjustBalanceDialog } from "../adjust-balance-dialog";

export default async function WalletDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ walletId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  if (data.role !== "super_admin") notFound();

  const { walletId } = await params;
  const sp = await searchParams;

  const admin = getSupabaseAdmin();
  const { data: wallet } = await admin
    .from("wallets")
    .select("*")
    .eq("id", walletId)
    .single();

  if (!wallet) notFound();

  // Get owner info
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", wallet.owner_id)
    .single();

  // Get companies under this genesis admin
  const { data: genesisCompanies } = await admin
    .from("company_memberships")
    .select("company_id, company:companies(id, dic, legal_name)")
    .eq("user_id", wallet.owner_id)
    .eq("is_genesis", true)
    .eq("status", "active");

  const companies = (genesisCompanies ?? [])
    .map((gc: any) => gc.company)
    .filter(Boolean);

  const [{ transactions, total }, unbilledCount] = await Promise.all([
    getWalletTransactions({
      walletId,
      companyId: sp.company || undefined,
      type: sp.type || undefined,
      limit: 50,
      offset: parseInt(sp.offset ?? "0", 10),
    }),
    getUnbilledCount(wallet.owner_id),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Wallet: {ownerProfile?.full_name ?? "Unknown Owner"}
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{wallet.available_balance.toFixed(2)} EUR</p>
            <AdjustBalanceDialog walletId={walletId} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unbilled Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unbilledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {companies.map((c: any) => (
                <li key={c.id}>{c.legal_name ?? c.dic}</li>
              ))}
              {companies.length === 0 && <li className="text-muted-foreground">None</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionHistory
            transactions={transactions}
            total={total}
            companies={companies.map((c: any) => ({ id: c.id, name: c.legal_name ?? c.dic }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

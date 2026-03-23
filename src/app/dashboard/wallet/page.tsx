export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole, getWalletForCurrentUser } from "@/lib/dal";
import { getWalletTransactions, getUnbilledCount } from "@/lib/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { WalletBalanceCard } from "./wallet-balance-card";
import { TransactionHistory } from "./transaction-history";
import { StatementExport } from "./statement-export";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { user, role, companies } = data;

  // Super admins don't have their own wallet — they manage via company pages
  if (role === "super_admin") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>As a super admin, you manage wallets through individual company pages.</p>
            <p className="text-sm mt-1">Go to Companies → select a company → Billing section.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const walletInfo = await getWalletForCurrentUser(user.id);

  if (!walletInfo) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No wallet found. A wallet is created when your company starts receiving documents.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { wallet, isOwner } = walletInfo;
  const params = await searchParams;

  const [{ transactions, total }, unbilledCount] = await Promise.all([
    getWalletTransactions({
      walletId: wallet.id,
      companyId: params.company || undefined,
      type: params.type || undefined,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
      limit: 50,
      offset: parseInt(params.offset ?? "0", 10),
    }),
    getUnbilledCount(wallet.owner_id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Wallet</h1>
        {!isOwner && (
          <Badge variant="secondary">Shared wallet (managed by your company admin)</Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <WalletBalanceCard
          balance={wallet.available_balance}
          walletId={wallet.id}
          isOwner={isOwner}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unbilled Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {unbilledCount > 0 ? (
                <span className="text-yellow-600 dark:text-yellow-400">{unbilledCount}</span>
              ) : (
                <span className="text-green-600 dark:text-green-400">0</span>
              )}
            </p>
            {unbilledCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Top up to unlock</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Companies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{companies.length}</p>
            <p className="text-xs text-muted-foreground mt-1">sharing this wallet</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Transaction History</CardTitle>
          {isOwner && (
            <StatementExport
              walletId={wallet.id}
              companies={companies.map((c) => ({ id: c.id, name: c.legal_name ?? c.dic }))}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBar
            filters={[
              {
                key: "type",
                label: "Type",
                type: "select",
                options: [
                  { label: "Charge", value: "charge" },
                  { label: "Top Up", value: "top_up" },
                  { label: "Adjustment", value: "adjustment" },
                  { label: "Refund", value: "refund" },
                ],
              },
              {
                key: "company",
                label: "Company",
                type: "select",
                options: companies.map((c) => ({
                  label: c.legal_name ?? c.dic,
                  value: c.id,
                })),
              },
            ]}
          />
          <TransactionHistory
            transactions={transactions}
            total={total}
            companies={companies.map((c) => ({ id: c.id, name: c.legal_name ?? c.dic }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

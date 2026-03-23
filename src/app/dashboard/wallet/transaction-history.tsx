"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WalletTransaction } from "@/lib/types";

const TYPE_STYLES: Record<string, string> = {
  charge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  top_up: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  adjustment: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  refund: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

function formatDate(date: string) {
  return new Date(date).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  transactions: WalletTransaction[];
  total: number;
  companies: { id: string; name: string }[];
}

export function TransactionHistory({ transactions, total, companies }: Props) {
  const companyMap: Record<string, string> = {};
  for (const c of companies) {
    companyMap[c.id] = c.name;
  }

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No transactions yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell>
                  <Badge className={TYPE_STYLES[txn.type] ?? ""}>{txn.type.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell className="text-sm">{txn.description ?? "-"}</TableCell>
                <TableCell className="text-sm">
                  {txn.company_id ? companyMap[txn.company_id] ?? txn.company_id.slice(0, 8) : "-"}
                </TableCell>
                <TableCell className={cn("text-right text-sm font-medium", txn.amount > 0 ? "text-green-600" : "text-red-600")}>
                  {txn.amount > 0 ? "+" : ""}{txn.amount.toFixed(4)}
                </TableCell>
                <TableCell className="text-right text-sm font-mono">{txn.balance_after.toFixed(4)}</TableCell>
                <TableCell className="text-right text-sm">{formatDate(txn.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground text-right">{total} total transactions</p>
    </div>
  );
}

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole, getRecentWebhooks } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/ui/pagination-controls";

function formatDate(date: string) {
  return new Date(date).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");
  if (data.role !== "super_admin") redirect("/dashboard");

  const params = await searchParams;
  const offset = parseInt(params.offset ?? "0", 10);
  const pageSize = 25;

  const { webhooks, total } = await getRecentWebhooks(pageSize, offset);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Webhooks Log</h1>
        <Badge variant="secondary">{total} entries</Badge>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DIC</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead className="hidden lg:table-cell">Verification Token</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No webhooks received yet
                </TableCell>
              </TableRow>
            ) : (
              webhooks.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-sm">{w.dic}</TableCell>
                  <TableCell>{w.legal_name ?? "-"}</TableCell>
                  <TableCell className="text-sm">{w.company_email ?? "-"}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {w.company_phone ?? "-"}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">
                    {w.verification_token ? w.verification_token.substring(0, 16) + "..." : "-"}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(w.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls total={total} pageSize={pageSize} currentOffset={offset} />
    </div>
  );
}

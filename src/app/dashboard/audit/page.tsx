export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole, getAuditLogs } from "@/lib/dal";
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
import { FilterBar } from "@/components/ui/filter-bar";

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

const SEVERITY_STYLES = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { role, user, memberships } = data;
  const params = await searchParams;
  const offset = parseInt(params.offset ?? "0", 10);
  const pageSize = 25;

  const companyIds = memberships.map((m) => m.company_id);

  const { logs, total } = await getAuditLogs({
    userId: user.id,
    companyId: params.company ?? null,
    isSuperAdmin: role === "super_admin",
    companyIds,
    severity: params.severity,
    eventId: params.event,
    dic: params.dic,
    actor: params.actor,
    dateFrom: params.from,
    dateTo: params.to,
    limit: pageSize,
    offset,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <span className="text-sm text-muted-foreground">{total} events</span>
      </div>

      <FilterBar
        filters={[
          {
            key: "severity",
            label: "Severity",
            type: "select",
            options: [
              { label: "Info", value: "info" },
              { label: "Warning", value: "warning" },
              { label: "Error", value: "error" },
            ],
          },
          { key: "event", label: "Event type", type: "search", placeholder: "Event ID..." },
          { key: "dic", label: "DIC", type: "search", placeholder: "Company DIC..." },
          { key: "actor", label: "Actor", type: "search", placeholder: "Actor email..." },
          { key: "from", label: "From", type: "search", placeholder: "From (YYYY-MM-DD)" },
          { key: "to", label: "To", type: "search", placeholder: "To (YYYY-MM-DD)" },
        ]}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Company DIC</TableHead>
              <TableHead className="hidden lg:table-cell">Source IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No audit events found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{log.event_name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {log.event_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={SEVERITY_STYLES[log.severity as keyof typeof SEVERITY_STYLES]}>
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.actor_email ?? "-"}</TableCell>
                  <TableCell className="font-mono text-sm">{log.company_dic ?? "-"}</TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">
                    {log.source_ip ?? "-"}
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

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserWithRole, getDocuments, getInboxCounts } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, MailOpen, FileText, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(date: string) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
  }

  return d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function documentTypeLabel(type: string | null) {
  if (!type) return "Document";
  switch (type) {
    case "Invoice": return "Invoice";
    case "CreditNote": return "Credit Note";
    default: return type;
  }
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { role, memberships } = data;
  const params = await searchParams;
  const companyFilter = params.company ?? null;
  const companyIds = memberships.map((m) => m.company_id);

  const [{ documents, total }, counts] = await Promise.all([
    getDocuments({
      companyIds,
      direction: "received",
      companyId: companyFilter,
      isSuperAdmin: role === "super_admin",
      limit: 50,
    }),
    getInboxCounts(companyIds, role === "super_admin"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Inbox</h1>
          {counts.unread > 0 && (
            <Badge variant="secondary">{counts.unread} unread</Badge>
          )}
        </div>
        <span className="text-sm text-muted-foreground">{total} documents</span>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Mail className="h-12 w-12" />
          <p className="text-lg">No documents received yet</p>
          <p className="text-sm">
            Documents will appear here when your companies receive Peppol invoices.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]" />
                <TableHead>From</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Document ID</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const isUnread = doc.status === "new";
                const isPending = doc.status === "pending" || doc.status === "processing";
                const isFailed = doc.status === "failed";
                const company = (doc as any).company;

                return (
                  <TableRow
                    key={doc.id}
                    className={cn(
                      isUnread && "bg-muted/30",
                      isFailed && "bg-destructive/5"
                    )}
                  >
                    <TableCell className="pr-0">
                      {isFailed ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : isUnread ? (
                        <Mail className="h-4 w-4 text-primary" />
                      ) : (
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/inbox/${doc.id}`}
                        className={cn(
                          "hover:underline",
                          isUnread ? "font-semibold" : "font-normal"
                        )}
                      >
                        {doc.sender_identifier ?? "Unknown sender"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">
                          {documentTypeLabel(doc.document_type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {doc.document_id ?? "-"}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {company?.legal_name ?? company?.dic ?? "-"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right text-sm",
                      isUnread && "font-semibold"
                    )}>
                      {doc.peppol_created_at ? formatDate(doc.peppol_created_at) : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { getUserWithRole, getDocument } from "@/lib/dal";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentActions } from "./document-actions";
import { DocumentTimeline } from "./document-timeline";
import { audit } from "@/lib/audit";
import { getUserDepartments } from "@/lib/dal";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function formatDate(date: string) {
  return new Date(date).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  assigned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  processed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { id } = await params;
  const { role, user, memberships } = data;

  const doc = await getDocument(id);
  if (!doc) notFound();

  // Check access
  if (role !== "super_admin") {
    const hasAccess = memberships.some((m) => m.company_id === doc.company_id);
    if (!hasAccess) notFound();
  }

  // Processor: can only view documents assigned to their department(s)
  if (role === "processor" && doc.department_id) {
    const userDepts = await getUserDepartments(user.id);
    const userDeptIds = userDepts.map((dm: any) => dm.department_id);
    if (!userDeptIds.includes(doc.department_id)) notFound();
  } else if (role === "processor" && !doc.department_id) {
    // Processor cannot see unassigned documents
    notFound();
  }

  // Billing gate: block unbilled documents for non-super-admins
  const isUnbilled = !doc.billed_at && ["new", "read", "assigned", "processed"].includes(doc.status);
  if (isUnbilled && role !== "super_admin") {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Document Locked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This document cannot be viewed because the wallet balance is insufficient.
              Please top up to unlock all pending documents.
            </p>
            <Link href="/dashboard/wallet">
              <Button>Go to Wallet</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No auto-mark-as-read — document stays "new" until assigned or processed

  const company = (doc as any).company;

  // Fetch notes and audit events for timeline
  const adminClient = getSupabaseAdmin();
  const [{ data: notes }, { data: auditEvents }] = await Promise.all([
    adminClient
      .from("document_notes")
      .select("id, note, type, created_at, user_id, user:profiles(full_name)")
      .eq("document_id", id)
      .order("created_at", { ascending: false }),
    adminClient
      .from("audit_logs")
      .select("id, event_id, event_name, actor_email, created_at, details")
      .or(`details->>documentId.eq.${id},details->>document_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Build timeline entries
  const AUDIT_ICONS: Record<string, string> = {
    DOCUMENT_READ: "mail",
    DOCUMENT_ASSIGNED: "folder",
    DOCUMENTS_BULK_ASSIGNED: "folder",
    DOCUMENT_PROCESSED: "check",
    DOCUMENT_CHARGED: "card",
    PEPPOL_DOCUMENT_RECEIVED: "file",
    DOCUMENT_NOTE_ADDED: "comment",
  };

  const timelineEntries = [
    ...(notes ?? []).map((n: any) => ({
      id: `note-${n.id}`,
      type: "note" as const,
      icon: n.type === "processed" ? "check" : "comment",
      title: n.type === "processed" ? "Marked as Processed" : "Note",
      detail: n.note,
      actor: n.user?.full_name ?? undefined,
      timestamp: n.created_at,
    })),
    ...(auditEvents ?? [])
      .filter((e: any) => e.event_id !== "DOCUMENT_NOTE_ADDED") // avoid duplicate with notes
      .map((e: any) => ({
        id: `audit-${e.id}`,
        type: "audit" as const,
        icon: AUDIT_ICONS[e.event_id] ?? "file",
        title: e.event_name,
        detail: undefined,
        actor: e.actor_email ?? undefined,
        timestamp: e.created_at,
      })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {documentTypeLabel(doc.document_type)} {doc.document_id ?? ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            From {doc.sender_identifier ?? "unknown"} to {doc.receiver_identifier ?? "unknown"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_STYLES[doc.status] ?? ""}>
            {doc.status}
          </Badge>
          <DocumentActions
            documentId={doc.id}
            status={doc.status}
            ionApTransactionId={doc.ion_ap_transaction_id}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sender
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm">{doc.sender_identifier ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receiver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm">{doc.receiver_identifier ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{company?.legal_name ?? company?.dic ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {doc.peppol_created_at ? formatDate(doc.peppol_created_at) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Transaction UUID:</span>{" "}
            <span className="font-mono">{doc.transaction_uuid ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">ion-AP Transaction ID:</span>{" "}
            <span className="font-mono">{doc.ion_ap_transaction_id}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Document Type:</span>{" "}
            {doc.document_type ?? "-"}
          </div>
          <div>
            <span className="text-muted-foreground">Direction:</span>{" "}
            {doc.direction}
          </div>
        </CardContent>
      </Card>

      <DocumentTimeline entries={timelineEntries} documentId={doc.id} />
    </div>
  );
}

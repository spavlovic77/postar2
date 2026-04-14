export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserWithRole, getDocument, getUserDepartments } from "@/lib/dal";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

import { DocumentActions } from "./document-actions";
import { DocumentSidebar } from "./document-sidebar";

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

const AUDIT_ICONS: Record<string, string> = {
  DOCUMENT_READ: "mail",
  DOCUMENT_ASSIGNED: "folder",
  DOCUMENTS_BULK_ASSIGNED: "folder",
  DOCUMENT_PROCESSED: "check",
  DOCUMENT_CHARGED: "card",
  PEPPOL_DOCUMENT_RECEIVED: "file",
  DOCUMENT_NOTE_ADDED: "comment",
};

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await getUserWithRole();
  if (!data) {
    redirect(`/?next=${encodeURIComponent(`/dashboard/inbox/${id}`)}`);
  }

  const { role, user, memberships } = data;

  const doc = await getDocument(id);
  if (!doc) notFound();

  if (role !== "super_admin") {
    const hasAccess = memberships.some((m) => m.company_id === doc.company_id);
    if (!hasAccess) notFound();
  }

  if (role === "processor" && doc.department_id) {
    const userDepts = await getUserDepartments(user.id);
    const userDeptIds = userDepts.map((dm: any) => dm.department_id);
    if (!userDeptIds.includes(doc.department_id)) notFound();
  } else if (role === "processor" && !doc.department_id) {
    notFound();
  }

  const isUnbilled = !doc.billed_at && ["new", "read", "assigned", "processed"].includes(doc.status);
  if (isUnbilled && role !== "super_admin") {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Card className="w-full max-w-md">
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

  const company = (doc as any).company;

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
      .filter((e: any) => e.event_id !== "DOCUMENT_NOTE_ADDED")
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

  const details = {
    sender: doc.sender_identifier ?? "-",
    receiver: doc.receiver_identifier ?? "-",
    company: company?.legal_name ?? company?.dic ?? "-",
    receivedAt: doc.peppol_created_at ?? null,
    transactionUuid: doc.transaction_uuid ?? "-",
    ionApTransactionId: String(doc.ion_ap_transaction_id),
    documentType: doc.document_type ?? "-",
    direction: doc.direction,
  };

  const pdfUrl = `/api/documents/${doc.id}/pdf`;

  return (
    <div className="-m-4 flex h-[calc(100dvh-3.5rem-5rem)] flex-col md:-m-6 md:h-[calc(100dvh-3.5rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b bg-background px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">
            {documentTypeLabel(doc.document_type)} {doc.document_id ?? ""}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            From {doc.sender_identifier ?? "unknown"} → {doc.receiver_identifier ?? "unknown"}
          </p>
        </div>
        <Badge className={STATUS_STYLES[doc.status] ?? ""}>{doc.status}</Badge>
        <DocumentActions
          documentId={doc.id}
          status={doc.status}
          ionApTransactionId={doc.ion_ap_transaction_id}
        />
      </div>

      {/* Main body: PDF + sidebar */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* PDF — iframe on desktop, button on mobile */}
        <div className="flex min-h-0 flex-1 bg-muted">
          <iframe
            src={pdfUrl}
            className="hidden h-full w-full md:block"
            title="Invoice PDF"
          />
          <div className="flex w-full items-start justify-center p-4 md:hidden">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent"
            >
              <FileDown className="h-4 w-4" /> Open PDF
            </a>
          </div>
        </div>
        <DocumentSidebar
          details={details}
          timelineEntries={timelineEntries}
          documentId={doc.id}
        />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { getUserWithRole, getDocument, updateDocumentStatus } from "@/lib/dal";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentActions } from "./document-actions";
import { audit } from "@/lib/audit";
import { getUserDepartments } from "@/lib/dal";

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
  read: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
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
  // TODO: re-enable billing lock
  const isUnbilled = false; // !doc.billed_at && ["new", "read", "assigned", "processed"].includes(doc.status);
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

  // Auto-mark as read on view
  if (doc.status === "new") {
    await updateDocumentStatus(id, "read");
    doc.status = "read";

    audit({
      eventId: "DOCUMENT_READ",
      eventName: "Document marked as read",
      actorId: user.id,
      actorEmail: user.email ?? undefined,
      companyId: doc.company_id,
      details: { documentId: doc.id, documentType: doc.document_type },
    });
  }

  const company = (doc as any).company;

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
    </div>
  );
}

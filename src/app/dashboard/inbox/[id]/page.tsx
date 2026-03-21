import { redirect, notFound } from "next/navigation";
import { getUserWithRole, getDocument, updateDocumentStatus } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentActions } from "./document-actions";
import { audit } from "@/lib/audit";

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

      {doc.xml_content && (
        <Card>
          <CardHeader>
            <CardTitle>XML Document</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs font-mono">
              {doc.xml_content}
            </pre>
          </CardContent>
        </Card>
      )}

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

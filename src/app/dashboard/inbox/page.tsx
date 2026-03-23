export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole, getDocuments, getInboxCounts } from "@/lib/dal";
import { FilterBar } from "@/components/ui/filter-bar";
import { InboxList } from "./inbox-list";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { role, memberships } = data;
  const params = await searchParams;
  const companyFilter = params.company ?? null;
  const companyIds = memberships.map((m) => m.company_id);
  const pageSize = 20;

  // Determine if user can triage (super admin, company admin, or operator)
  const allRoles = memberships.flatMap((m) => m.roles ?? []);
  const canTriage =
    role === "super_admin" ||
    allRoles.includes("company_admin") ||
    allRoles.includes("operator");

  const [{ documents, total }, counts] = await Promise.all([
    getDocuments({
      companyIds,
      direction: "received",
      companyId: companyFilter,
      isSuperAdmin: role === "super_admin",
      status: params.status || undefined,
      documentType: params.type || undefined,
      search: params.q || undefined,
      limit: pageSize,
    }),
    getInboxCounts(companyIds, role === "super_admin"),
  ]);

  const nextCursor =
    documents.length === pageSize
      ? documents[documents.length - 1].peppol_created_at
      : null;

  return (
    <div className="space-y-4">
      <InboxList
        initialDocuments={documents}
        total={total}
        unreadCount={counts.unread}
        nextCursor={nextCursor}
        companyFilter={companyFilter}
        canTriage={canTriage}
        isSuperAdmin={role === "super_admin"}
        filters={
          <FilterBar
            filters={[
              { key: "q", label: "Search", type: "search", placeholder: "Sender or document ID..." },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: [
                  { label: "Unread", value: "new" },
                  { label: "Read", value: "read" },
                  { label: "Assigned", value: "assigned" },
                  { label: "Processed", value: "processed" },
                  { label: "Pending", value: "pending" },
                  { label: "Failed", value: "failed" },
                ],
              },
              {
                key: "type",
                label: "Type",
                type: "select",
                options: [
                  { label: "Invoice", value: "Invoice" },
                  { label: "Credit Note", value: "CreditNote" },
                ],
              },
            ]}
          />
        }
      />
    </div>
  );
}

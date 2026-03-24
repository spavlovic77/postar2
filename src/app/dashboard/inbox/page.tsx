export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole, getDocuments, getInboxCounts, getUserDepartments } from "@/lib/dal";
import { FilterBar } from "@/components/ui/filter-bar";
import { InboxList } from "./inbox-list";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { role, user, memberships } = data;
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

  // Processors only see documents assigned to their department(s)
  let departmentIds: string[] | undefined;
  if (role === "processor") {
    const userDepts = await getUserDepartments(user.id);
    departmentIds = userDepts.map((dm: any) => dm.department_id);
    if (departmentIds.length === 0) {
      // Processor not in any department — show nothing
      departmentIds = ["__none__"];
    }
  }

  let statusFilter = params.status || undefined;
  let unassignedFilter = false;

  // "unassigned" is a pseudo-status: filters by department_id IS NULL
  if (statusFilter === "unassigned") {
    unassignedFilter = true;
    statusFilter = undefined;
  }

  const [{ documents, total }, counts] = await Promise.all([
    getDocuments({
      companyIds,
      direction: "received",
      companyId: companyFilter,
      isSuperAdmin: role === "super_admin",
      departmentIds,
      unassignedOnly: unassignedFilter,
      status: statusFilter,
      documentType: params.type || undefined,
      search: params.q || undefined,
      limit: pageSize,
    }),
    getInboxCounts(companyIds, role === "super_admin", departmentIds),
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
                allLabel: "All statuses",
                type: "select",
                options: [
                  ...(canTriage ? [{ label: "Unassigned", value: "unassigned" }] : []),
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
                allLabel: "All types",
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

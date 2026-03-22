export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole, getDocuments, getInboxCounts } from "@/lib/dal";
import { InboxList } from "./inbox-list";

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
  const pageSize = 20;

  const [{ documents, total }, counts] = await Promise.all([
    getDocuments({
      companyIds,
      direction: "received",
      companyId: companyFilter,
      isSuperAdmin: role === "super_admin",
      limit: pageSize,
    }),
    getInboxCounts(companyIds, role === "super_admin"),
  ]);

  const nextCursor =
    documents.length === pageSize
      ? documents[documents.length - 1].peppol_created_at
      : null;

  return (
    <InboxList
      initialDocuments={documents}
      total={total}
      unreadCount={counts.unread}
      nextCursor={nextCursor}
      companyFilter={companyFilter}
    />
  );
}

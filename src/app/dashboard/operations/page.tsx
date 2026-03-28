export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/dal";
import { OpsCenter } from "./ops-center";
import {
  opsGetCompaniesWithIssues,
  opsGetFailedDocuments,
  opsGetPendingPayments,
  opsGetUnbilledSummary,
  opsGetPendingInvitations,
} from "./ops-actions";

export default async function OperationsPage() {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { role } = data;
  if (role !== "super_admin" && role !== "company_admin") {
    redirect("/dashboard");
  }

  const [companies, documents, payments, billing, invitations] = await Promise.all([
    opsGetCompaniesWithIssues(),
    opsGetFailedDocuments(),
    opsGetPendingPayments(),
    opsGetUnbilledSummary(),
    opsGetPendingInvitations(),
  ]);

  return (
    <OpsCenter
      companies={companies}
      documents={documents}
      payments={payments}
      billing={billing}
      invitations={invitations}
      isSuperAdmin={role === "super_admin"}
    />
  );
}

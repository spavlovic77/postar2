export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole, getCompaniesWithMemberCounts } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, ChevronRight } from "lucide-react";
import { PeppolStatusBadge } from "@/components/dashboard/peppol-status-badge";
import { CompanyRow } from "./company-row";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function CompaniesPage() {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { role, memberships } = data;

  const companyIds =
    role === "super_admin"
      ? undefined
      : memberships.map((m) => m.company_id);

  const { companies, memberCounts } = await getCompaniesWithMemberCounts(companyIds);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Companies</h1>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>DIC</TableHead>
              <TableHead>Peppol</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No companies found
                </TableCell>
              </TableRow>
            ) : (
              companies.map((c) => (
                <CompanyRow key={c.id} company={c} memberCount={memberCounts[c.id] ?? 0} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

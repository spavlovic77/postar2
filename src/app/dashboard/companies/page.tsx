import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserWithRole, getCompaniesWithMemberCounts } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";

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
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No companies found
                </TableCell>
              </TableRow>
            ) : (
              companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/companies/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.legal_name ?? "-"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{c.dic}</TableCell>
                  <TableCell className="text-sm">{c.company_email ?? "-"}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {c.company_phone ?? "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {memberCounts[c.id] ?? 0}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {formatDate(c.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

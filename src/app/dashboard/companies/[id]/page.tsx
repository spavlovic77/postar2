import { redirect, notFound } from "next/navigation";
import { getUserWithRole, getCompanyWithMembers } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeactivateButton } from "./deactivate-button";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { id } = await params;
  const { role, user, memberships } = data;

  // Check access
  if (role !== "super_admin") {
    const hasAccess = memberships.some((m) => m.company_id === id);
    if (!hasAccess) notFound();
  }

  const { company, members } = await getCompanyWithMembers(id);
  if (!company) notFound();

  // Determine if current user can deactivate members
  const myMembership = memberships.find((m) => m.company_id === id);
  const canManageMembers =
    role === "super_admin" ||
    (myMembership?.role === "company_admin");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{company.legal_name ?? company.dic}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">DIC</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-lg font-bold">{company.dic}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{company.company_email ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Phone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{company.company_phone ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">
              {members.filter((m) => m.status === "active").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Members</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                {canManageMembers && <TableHead className="w-[100px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageMembers ? 5 : 4}
                    className="text-center text-muted-foreground"
                  >
                    No members
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => {
                  const profile = (m as { profile: { full_name: string | null } }).profile;
                  const canDeactivate =
                    canManageMembers &&
                    m.status === "active" &&
                    m.user_id !== user.id;

                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <span className="font-medium">
                          {profile?.full_name ?? "Unnamed"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {m.role.replace("_", " ")}
                          </Badge>
                          {m.is_genesis && (
                            <Badge variant="secondary" className="text-xs">
                              Genesis
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.status === "active" ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {formatDate(m.created_at)}
                      </TableCell>
                      {canManageMembers && (
                        <TableCell>
                          {canDeactivate && (
                            <DeactivateButton membershipId={m.id} />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

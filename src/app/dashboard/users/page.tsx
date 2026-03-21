import { redirect } from "next/navigation";
import { getUserWithRole, getAllUsers, getInvitations } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteUserDialog } from "./invite-user-dialog";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function UsersPage() {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { role, user, companies, memberships } = data;

  if (role === "accountant") redirect("/dashboard");

  const [allUsers, invitations] = await Promise.all([
    role === "super_admin" ? getAllUsers() : getAllUsers(),
    getInvitations({
      isSuperAdmin: role === "super_admin",
      userId: user.id,
      companyIds: memberships.map((m) => m.company_id),
    }),
  ]);

  // For non-super-admins, filter to users who share companies
  const myCompanyIds = memberships.map((m) => m.company_id);
  const users =
    role === "super_admin"
      ? allUsers
      : allUsers.filter(
          (u) =>
            u.id === user.id ||
            u.memberships?.some((m: { company_id: string }) =>
              myCompanyIds.includes(m.company_id)
            )
        );

  // Companies the current user can invite to
  const invitableCompanies =
    role === "super_admin"
      ? companies
      : companies.filter((c) =>
          memberships.some(
            (m) => m.company_id === c.id && m.role === "company_admin"
          )
        );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users & Invitations</h1>
        {invitableCompanies.length > 0 && (
          <InviteUserDialog companies={invitableCompanies} />
        )}
      </div>

      {/* Users Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Companies</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.full_name ?? "Unnamed"}
                  </TableCell>
                  <TableCell className="text-sm">{u.email ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.is_super_admin && (
                        <Badge>Super Admin</Badge>
                      )}
                      {u.memberships?.map((m: { id: string; role: string; is_genesis: boolean }) => (
                        <Badge key={m.id} variant="outline" className="text-xs">
                          {m.role.replace("_", " ")}
                          {m.is_genesis ? " (genesis)" : ""}
                        </Badge>
                      ))}
                      {!u.is_super_admin && (!u.memberships || u.memberships.length === 0) && (
                        <span className="text-sm text-muted-foreground">No role</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {u.memberships?.map((m: { id: string; company?: { legal_name?: string; dic: string } | null }) => (
                        <Badge key={m.id} variant="secondary" className="text-xs">
                          {m.company?.legal_name ?? m.company?.dic ?? "?"}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {formatDate(u.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Invitations Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Invitations</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No invitations
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {inv.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.accepted_at ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Accepted
                        </Badge>
                      ) : new Date(inv.expires_at) < new Date() ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {formatDate(inv.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

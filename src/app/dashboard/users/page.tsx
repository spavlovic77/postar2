export const dynamic = "force-dynamic";

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
import { ResendInvitationButton } from "./resend-invitation-button";
import { FilterBar } from "@/components/ui/filter-bar";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");
  const params = await searchParams;

  const { role, user, companies, memberships } = data;

  if (role === "processor") redirect("/dashboard");

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

  // Apply search filters
  const userSearch = params.user_search?.toLowerCase();
  const userRole = params.user_role;
  const filteredUsers = users.filter((u) => {
    if (userSearch) {
      const nameMatch = u.full_name?.toLowerCase().includes(userSearch);
      const emailMatch = u.email?.toLowerCase().includes(userSearch);
      if (!nameMatch && !emailMatch) return false;
    }
    if (userRole === "super_admin" && !u.is_super_admin) return false;
    if (userRole === "company_admin" && !u.memberships?.some((m: { roles?: string[] }) => m.roles?.includes("company_admin"))) return false;
    if (userRole === "processor" && !u.memberships?.some((m: { roles?: string[] }) => m.roles?.includes("processor"))) return false;
    return true;
  });

  const invSearch = params.inv_search?.toLowerCase();
  const invStatus = params.inv_status;
  const now = new Date();
  const filteredInvitations = invitations.filter((inv) => {
    if (invSearch && !inv.email.toLowerCase().includes(invSearch)) return false;
    if (invStatus === "accepted" && !inv.accepted_at) return false;
    if (invStatus === "pending" && (inv.accepted_at || new Date(inv.expires_at) < now)) return false;
    if (invStatus === "expired" && (inv.accepted_at || new Date(inv.expires_at) >= now)) return false;
    return true;
  });

  // Companies the current user can invite to
  const invitableCompanies =
    role === "super_admin"
      ? companies
      : companies.filter((c) =>
          memberships.some(
            (m) => m.company_id === c.id && m.roles?.includes("company_admin")
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
        <FilterBar
          filters={[
            { key: "user_search", label: "Search", type: "search", placeholder: "Name or email..." },
            {
              key: "user_role",
              label: "Role",
              type: "select",
              options: [
                { label: "Super Admin", value: "super_admin" },
                { label: "Company Admin", value: "company_admin" },
                { label: "Company Admin", value: "company_admin" },
                { label: "Operator", value: "operator" },
                { label: "Processor", value: "processor" },
              ],
            },
          ]}
        />
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
              {filteredUsers.map((u) => (
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
                      {u.memberships?.map((m: { id: string; roles?: string[]; is_genesis: boolean }) => (
                        <Badge key={m.id} variant="outline" className="text-xs">
                          {m.roles?.join(", ").replace(/_/g, " ")}
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
        <FilterBar
          filters={[
            { key: "inv_search", label: "Search", type: "search", placeholder: "Email..." },
            {
              key: "inv_status",
              label: "Status",
              type: "select",
              options: [
                { label: "Pending", value: "pending" },
                { label: "Accepted", value: "accepted" },
                { label: "Expired", value: "expired" },
              ],
            },
          ]}
        />
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Sent</TableHead>
                {role === "super_admin" && <TableHead className="w-[80px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={role === "super_admin" ? 5 : 4} className="text-center text-muted-foreground">
                    No invitations
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvitations.map((inv) => {
                  const isExpiredOrPending = !inv.accepted_at;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {inv.roles?.join(", ").replace(/_/g, " ")}
                          {inv.is_genesis ? " (genesis)" : ""}
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
                      {role === "super_admin" && (
                        <TableCell>
                          {isExpiredOrPending && (
                            <ResendInvitationButton invitationId={inv.id} />
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

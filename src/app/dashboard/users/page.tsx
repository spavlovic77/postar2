export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole, getAllUsers, getInvitations } from "@/lib/dal";
import { UsersView } from "./users-view";

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
    getAllUsers(),
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
    <UsersView
      users={users}
      invitations={invitations}
      companies={invitableCompanies}
      allCompanies={companies}
      currentUserId={user.id}
      role={role}
      initialTab={params.tab ?? "team"}
    />
  );
}

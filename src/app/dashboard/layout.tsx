import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/dal";
import { getNavForRole } from "@/lib/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { WelcomeScreen } from "@/components/dashboard/welcome-screen";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getUserWithRole();

  if (!data) {
    redirect("/");
  }

  const { profile, role, companies, user } = data;

  // Show welcome screen if not onboarded
  if (!profile.onboarded_at) {
    return (
      <WelcomeScreen
        fullName={profile.full_name}
        role={role}
        companies={companies}
      />
    );
  }

  const navItems = getNavForRole(role);

  // For super admin, fetch all companies for the switcher
  let switcherCompanies = companies;
  if (role === "super_admin") {
    const { getAllCompanies } = await import("@/lib/dal");
    switcherCompanies = await getAllCompanies();
  }

  return (
    <AppShell
      navItems={navItems}
      companies={switcherCompanies}
      fullName={profile.full_name}
      email={user.email}
      avatarUrl={profile.avatar_url}
      role={role}
      memberships={data.memberships}
      isSuperAdmin={profile.is_super_admin}
    >
      {children}
    </AppShell>
  );
}

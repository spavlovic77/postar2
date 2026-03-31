export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import {
  getUserWithRole,
  getSuperAdminStats,
  getCompanyAdminData,
} from "@/lib/dal";
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard";
import { CompanyAdminDashboard } from "@/components/dashboard/company-admin-dashboard";
import { ProcessorDashboard } from "@/components/dashboard/processor-dashboard";

export default async function DashboardPage() {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { role, user, companies } = data;

  if (role === "super_admin") {
    const stats = await getSuperAdminStats();

    return <SuperAdminDashboard stats={stats} />;
  }

  if (role === "company_admin" || role === "operator") {
    const adminData = await getCompanyAdminData(user.id);

    return (
      <CompanyAdminDashboard
        memberships={adminData.memberships}
        memberCounts={adminData.memberCounts}
        pendingInvitations={adminData.pendingInvitations}
        slaStats={adminData.slaStats}
      />
    );
  }

  // Processor — redirect to inbox (no dashboard for this role)
  if (role === "processor") redirect("/dashboard/inbox");

  return <ProcessorDashboard companies={companies} />;
}

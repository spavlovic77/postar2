export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import {
  getUserWithRole,
  getSuperAdminStats,
  getRecentWebhooks,
  getRecentInvitations,
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
    const [stats, webhooksResult, recentInvitations] = await Promise.all([
      getSuperAdminStats(),
      getRecentWebhooks({ limit: 10 }),
      getRecentInvitations(),
    ]);

    return (
      <SuperAdminDashboard
        stats={stats}
        recentWebhooks={webhooksResult.webhooks}
        recentInvitations={recentInvitations}
      />
    );
  }

  if (role === "company_admin" || role === "operator") {
    const adminData = await getCompanyAdminData(user.id);

    return (
      <CompanyAdminDashboard
        memberships={adminData.memberships}
        memberCounts={adminData.memberCounts}
        pendingInvitations={adminData.pendingInvitations}
      />
    );
  }

  // Processor
  return <ProcessorDashboard companies={companies} />;
}

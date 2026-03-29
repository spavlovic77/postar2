import { Building2, Users, Mail, Webhook } from "lucide-react";
import { StatsCard } from "./stats-card";
import { SendOnboardingRequest } from "./send-onboarding-request";

interface Props {
  stats: {
    totalCompanies: number;
    totalUsers: number;
    pendingInvitations: number;
    totalWebhooks: number;
  };
}

export function SuperAdminDashboard({ stats }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Companies"
          value={stats.totalCompanies}
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Users"
          value={stats.totalUsers}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Pending Invitations"
          value={stats.pendingInvitations}
          icon={<Mail className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Webhooks"
          value={stats.totalWebhooks}
          icon={<Webhook className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <SendOnboardingRequest />
    </div>
  );
}

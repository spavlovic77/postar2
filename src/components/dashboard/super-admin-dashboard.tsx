import { Building2, Users, Mail, Webhook } from "lucide-react";
import { StatsCard } from "./stats-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Invitation, PfsVerification } from "@/lib/types";

interface Props {
  stats: {
    totalCompanies: number;
    totalUsers: number;
    pendingInvitations: number;
    totalWebhooks: number;
  };
  recentWebhooks: PfsVerification[];
  recentInvitations: Invitation[];
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SuperAdminDashboard({
  stats,
  recentWebhooks,
  recentInvitations,
}: Props) {
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Webhooks */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recent Webhooks</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DIC</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentWebhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No webhooks yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recentWebhooks.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-sm">{w.dic}</TableCell>
                      <TableCell>{w.legal_name ?? "-"}</TableCell>
                      <TableCell className="text-sm">{w.company_email ?? "-"}</TableCell>
                      <TableCell className="text-sm">{formatDate(w.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Recent Invitations */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recent Invitations</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No invitations yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recentInvitations.map((inv) => (
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
                      <TableCell className="text-sm">{formatDate(inv.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

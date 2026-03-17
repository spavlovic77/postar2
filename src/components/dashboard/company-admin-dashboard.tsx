import { Building2, Users, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Company, CompanyMembership } from "@/lib/types";

interface Props {
  memberships: (CompanyMembership & { company: Company })[];
  memberCounts: Record<string, number>;
  pendingInvitations: Record<string, number>;
}

export function CompanyAdminDashboard({
  memberships,
  memberCounts,
  pendingInvitations,
}: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map((m) => {
          const company = m.company;
          if (!company) return null;

          return (
            <Card key={m.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">
                    {company.legal_name ?? company.dic}
                  </CardTitle>
                  {m.is_genesis && (
                    <Badge variant="secondary" className="text-xs">
                      Genesis
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  DIC: {company.dic}
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {memberCounts[company.id] ?? 0} members
                  </div>
                  {(pendingInvitations[company.id] ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {pendingInvitations[company.id]} pending
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {memberships.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Building2 className="h-8 w-8" />
            <p>No companies assigned yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

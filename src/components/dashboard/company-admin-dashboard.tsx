"use client";

import { useState } from "react";
import { Building2, Users, Mail, ChevronDown, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PeppolStatusBadge } from "./peppol-status-badge";
import { SendTestInvoicesButton } from "./send-test-invoices-button";
import { cn } from "@/lib/utils";
import type { Company, CompanyMembership } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  company_admin: "Company Admin",
  operator: "Operator",
  processor: "Processor",
};

const ROLE_COLORS: Record<string, string> = {
  company_admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  operator: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  processor: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

function getPermissions(roles: string[], isGenesis: boolean): { can: string[]; cannot: string[] } {
  const can: string[] = [];
  const cannot: string[] = [];

  const isAdmin = roles.includes("company_admin");
  const isOperator = roles.includes("operator");
  const isProcessor = roles.includes("processor");

  // What you CAN do
  can.push("View & download invoices");

  if (isAdmin || isOperator) {
    can.push("Assign invoices to departments");
  }

  if (isAdmin) {
    can.push("Invite operators and processors");
    can.push("Manage departments");
    if (isGenesis) {
      can.push("Invite other company admins");
      can.push("Deactivate non-genesis members");
    }
  }

  if (isOperator) {
    can.push("Manage department members");
  }

  if (isAdmin || isOperator) {
    can.push("View audit logs");
  }

  // What you CANNOT do
  if (isProcessor) {
    cannot.push("Only see documents in your department(s)");
    cannot.push("Cannot assign or triage documents");
  }

  if (isOperator && !isAdmin) {
    cannot.push("Cannot invite users");
  }

  if (isAdmin && !isGenesis) {
    cannot.push("Cannot deactivate other admins");
    cannot.push("Cannot assign Company Admin role");
  }

  return { can, cannot };
}

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
            <CompanyCard
              key={m.id}
              membership={m}
              company={company}
              memberCount={memberCounts[company.id] ?? 0}
              pendingCount={pendingInvitations[company.id] ?? 0}
            />
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

function CompanyCard({
  membership,
  company,
  memberCount,
  pendingCount,
}: {
  membership: CompanyMembership;
  company: Company;
  memberCount: number;
  pendingCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const roles = membership.roles ?? [];
  const { can, cannot } = getPermissions(roles, membership.is_genesis);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">
            {company.legal_name ?? company.dic}
          </CardTitle>
          {membership.is_genesis && (
            <Badge variant="secondary" className="text-xs">
              Genesis
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            DIC: {company.dic}
          </span>
          <PeppolStatusBadge status={company.ion_ap_status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Role badges */}
        <div className="flex flex-wrap gap-1.5">
          {roles.map((role) => (
            <Badge key={role} className={cn("text-xs", ROLE_COLORS[role] ?? "")}>
              {ROLE_LABELS[role] ?? role}
            </Badge>
          ))}
        </div>

        {/* Expandable permissions */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Hide permissions" : "View permissions"}
        </button>

        {expanded && (
          <div className="space-y-2 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
            {can.length > 0 && (
              <div className="space-y-1">
                {can.map((perm) => (
                  <div key={perm} className="flex items-start gap-1.5 text-green-700 dark:text-green-400">
                    <Check className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{perm}</span>
                  </div>
                ))}
              </div>
            )}
            {cannot.length > 0 && (
              <div className="space-y-1 pt-1">
                {cannot.map((perm) => (
                  <div key={perm} className="flex items-start gap-1.5 text-muted-foreground">
                    <X className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{perm}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {memberCount} members
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {pendingCount} pending
            </div>
          )}
        </div>

        {/* Test invoices button */}
        {company.ion_ap_status === "active" && (
          <div className="pt-2 border-t">
            <SendTestInvoicesButton
              companyId={company.id}
              companyName={company.legal_name ?? company.dic}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

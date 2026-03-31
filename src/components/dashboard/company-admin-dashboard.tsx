"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Users, Mail, ChevronDown, Check, X, Clock, AlertTriangle, CheckCircle2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PeppolStatusBadge } from "./peppol-status-badge";
import { SendTestInvoicesButton } from "./send-test-invoices-button";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/types";
import type { Company, CompanyMembership } from "@/lib/types";

function getPermissions(role: string, isGenesis: boolean): { can: string[]; cannot: string[] } {
  const can: string[] = [];
  const cannot: string[] = [];

  const isAdmin = role === "company_admin";
  const isOperator = role === "operator";
  const isProcessor = role === "processor";

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

interface SlaStats {
  awaitingTriage: number;
  awaitingProcess: number;
  processedToday: number;
  overdueTriageCount: number;
  overdueProcessCount: number;
  processorStats: { userId: string; fullName: string | null; processedToday: number }[];
}

interface Props {
  memberships: (CompanyMembership & { company: Company })[];
  memberCounts: Record<string, number>;
  pendingInvitations: Record<string, number>;
  slaStats: Record<string, SlaStats>;
}

export function CompanyAdminDashboard({
  memberships,
  memberCounts,
  pendingInvitations,
  slaStats,
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
              sla={slaStats[company.id]}
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
  sla,
}: {
  membership: CompanyMembership;
  company: Company;
  memberCount: number;
  pendingCount: number;
  sla?: SlaStats;
}) {
  const [expanded, setExpanded] = useState(false);
  const role = membership.role ?? "processor";
  const { can, cannot } = getPermissions(role, membership.is_genesis);
  const isAdminOrOperator = role === "company_admin" || role === "operator";

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
        {/* Role badge */}
        <div className="flex flex-wrap gap-1.5">
          <Badge className={cn("text-xs", ROLE_COLORS[role] ?? "")}>
            {ROLE_LABELS[role] ?? role}
          </Badge>
        </div>

        {/* SLA Status — visible to admin and operator */}
        {isAdminOrOperator && sla && (sla.awaitingTriage > 0 || sla.awaitingProcess > 0 || sla.processedToday > 0) && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Link
              href={`/dashboard/inbox?company=${company.id}&status=new`}
              className="rounded-lg border p-2 hover:bg-muted/50 transition-colors"
            >
              <div className={cn("text-lg font-bold", sla.overdueTriageCount > 0 ? "text-destructive" : "text-foreground")}>
                {sla.awaitingTriage}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">Triage</div>
              {sla.overdueTriageCount > 0 && (
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  <span className="text-[10px] font-medium text-destructive">{sla.overdueTriageCount} overdue</span>
                </div>
              )}
            </Link>
            <Link
              href={`/dashboard/inbox?company=${company.id}&status=assigned`}
              className="rounded-lg border p-2 hover:bg-muted/50 transition-colors"
            >
              <div className={cn("text-lg font-bold", sla.overdueProcessCount > 0 ? "text-orange-600 dark:text-orange-400" : "text-foreground")}>
                {sla.awaitingProcess}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">Process</div>
              {sla.overdueProcessCount > 0 && (
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <AlertTriangle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                  <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400">{sla.overdueProcessCount} overdue</span>
                </div>
              )}
            </Link>
            <div className="rounded-lg border p-2">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {sla.processedToday}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">Processed</div>
              <div className="text-[10px] text-muted-foreground mt-1">today</div>
            </div>
          </div>
        )}

        {/* SLA config hint */}
        {isAdminOrOperator && sla && (sla.awaitingTriage > 0 || sla.awaitingProcess > 0) && (
          <p className="text-[10px] text-muted-foreground">
            SLA: triage {company.sla_triage_hours ?? 8}h, process {company.sla_process_hours ?? 24}h
          </p>
        )}

        {/* Per-person stats */}
        {isAdminOrOperator && sla && sla.processorStats.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Today's activity</p>
            {sla.processorStats.map((p) => (
              <div key={p.userId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{p.fullName ?? "Unnamed"}</span>
                </div>
                <span className="font-medium text-green-600 dark:text-green-400 shrink-0">
                  {p.processedToday} processed
                </span>
              </div>
            ))}
          </div>
        )}

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

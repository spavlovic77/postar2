"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Users,
  Mail,
  Search,
  UserPlus,
  RefreshCw,
  UserX,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { InviteUserDialog } from "./invite-user-dialog";
import { ResendInvitationButton } from "./resend-invitation-button";
import { RevokeInvitationButton } from "./revoke-invitation-button";
import { UserDetailDrawer } from "./user-detail-drawer";
import type { AppRole, Company } from "@/lib/types";

interface UserEntry {
  id: string;
  full_name: string | null;
  email: string | null;
  is_super_admin: boolean;
  created_at: string;
  memberships?: {
    id: string;
    company_id: string;
    roles?: string[];
    is_genesis: boolean;
    status: string;
    company?: { id: string; dic: string; legal_name?: string | null } | null;
  }[];
}

interface InvitationEntry {
  id: string;
  email: string;
  roles: string[];
  company_ids: string[];
  is_genesis: boolean;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface Props {
  users: UserEntry[];
  invitations: InvitationEntry[];
  companies: Company[];
  allCompanies: Company[];
  currentUserId: string;
  role: AppRole;
  initialTab: string;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  company_admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  operator: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  processor: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export function UsersView({
  users,
  invitations,
  companies,
  allCompanies,
  currentUserId,
  role,
  initialTab,
}: Props) {
  const [activeTab, setActiveTab] = useState<"team" | "invitations">(
    initialTab === "invitations" ? "invitations" : "team"
  );
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const now = new Date();

  // Stats
  const activeCount = users.filter((u) =>
    u.memberships?.some((m) => m.status === "active")
  ).length;
  const pendingInvitations = invitations.filter(
    (inv) => !inv.accepted_at && new Date(inv.expires_at) >= now
  );
  const expiredInvitations = invitations.filter(
    (inv) => !inv.accepted_at && new Date(inv.expires_at) < now
  );

  // Company lookup
  const companyMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of allCompanies) {
      map[c.id] = c.legal_name ?? c.dic;
    }
    return map;
  }, [allCompanies]);

  // Build unified people list for Team tab
  const teamMembers = useMemo(() => {
    const lowerSearch = search.toLowerCase();

    // Active users
    const activeUsers = users
      .filter((u) => {
        if (!search) return true;
        return (
          u.full_name?.toLowerCase().includes(lowerSearch) ||
          u.email?.toLowerCase().includes(lowerSearch)
        );
      })
      .map((u) => ({
        type: "user" as const,
        id: u.id,
        name: u.full_name ?? null,
        email: u.email,
        isSuperAdmin: u.is_super_admin,
        isCurrentUser: u.id === currentUserId,
        joinedAt: u.created_at,
        memberships: (u.memberships ?? []).filter((m) => m.status === "active"),
      }));

    // Pending invitations (not yet accepted) — show as people
    const pendingPeople = pendingInvitations
      .filter((inv) => {
        if (!search) return true;
        return inv.email.toLowerCase().includes(lowerSearch);
      })
      .filter((inv) => {
        // Don't show if the email already appears as an active user
        return !users.some((u) => u.email === inv.email && u.memberships?.some((m) => m.status === "active"));
      })
      .map((inv) => ({
        type: "invitation" as const,
        id: inv.id,
        name: null as string | null,
        email: inv.email,
        roles: inv.roles,
        companyIds: inv.company_ids,
        isGenesis: inv.is_genesis,
        sentAt: inv.created_at,
        expiresAt: inv.expires_at,
      }));

    return [...activeUsers, ...pendingPeople];
  }, [users, pendingInvitations, search, currentUserId]);

  // Find the selected user for the drawer
  const selectedUserDetail = useMemo(() => {
    if (!selectedUserId) return null;
    const member = teamMembers.find(
      (m) => m.type === "user" && m.id === selectedUserId
    );
    if (!member || member.type !== "user") return null;
    return member;
  }, [selectedUserId, teamMembers]);

  // Filtered invitations for Invitations tab
  const filteredInvitations = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return invitations.filter((inv) => {
      if (!search) return true;
      return inv.email.toLowerCase().includes(lowerSearch);
    });
  }, [invitations, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        {companies.length > 0 && <InviteUserDialog companies={companies} />}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="font-medium">{activeCount}</span>
          <span className="text-muted-foreground">active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-yellow-600" />
          <span className="font-medium">{pendingInvitations.length}</span>
          <span className="text-muted-foreground">pending</span>
        </div>
        {expiredInvitations.length > 0 && (
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{expiredInvitations.length}</span>
            <span className="text-muted-foreground">expired</span>
          </div>
        )}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            onClick={() => setActiveTab("team")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "team"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="mr-1.5 inline h-4 w-4" />
            Team
          </button>
          <button
            onClick={() => setActiveTab("invitations")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "invitations"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mail className="mr-1.5 inline h-4 w-4" />
            Invitations
            {pendingInvitations.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {pendingInvitations.length}
              </Badge>
            )}
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "team" ? (
        <TeamTab
          members={teamMembers}
          companyMap={companyMap}
          role={role}
          onSelectUser={setSelectedUserId}
        />
      ) : (
        <InvitationsTab
          invitations={filteredInvitations}
          companyMap={companyMap}
          role={role}
        />
      )}

      {/* User detail drawer */}
      <UserDetailDrawer
        user={selectedUserDetail}
        open={!!selectedUserId}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}
        companies={companies}
        viewerRole={role}
      />
    </div>
  );
}

// ============================================================
// Team Tab — unified person cards
// ============================================================

function TeamTab({
  members,
  companyMap,
  role,
  onSelectUser,
}: {
  members: (
    | {
        type: "user";
        id: string;
        name: string | null;
        email: string | null;
        isSuperAdmin: boolean;
        isCurrentUser: boolean;
        joinedAt: string;
        memberships: {
          id: string;
          company_id: string;
          roles?: string[];
          is_genesis: boolean;
          company?: { id: string; dic: string; legal_name?: string | null } | null;
        }[];
      }
    | {
        type: "invitation";
        id: string;
        name: string | null;
        email: string;
        roles: string[];
        companyIds: string[];
        isGenesis: boolean;
        sentAt: string;
        expiresAt: string;
      }
  )[];
  companyMap: Record<string, string>;
  role: AppRole;
  onSelectUser: (userId: string) => void;
}) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Users className="h-12 w-12" />
        <p className="text-lg">No team members yet</p>
        <p className="text-sm">Invite your first user to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) =>
        member.type === "user" ? (
          <UserCard key={`user-${member.id}`} member={member} companyMap={companyMap} role={role} onSelect={() => onSelectUser(member.id)} />
        ) : (
          <InvitationCard key={`inv-${member.id}`} invitation={member} companyMap={companyMap} role={role} />
        )
      )}
    </div>
  );
}

function UserCard({
  member,
  companyMap,
  role: viewerRole,
  onSelect,
}: {
  member: {
    id: string;
    name: string | null;
    email: string | null;
    isSuperAdmin: boolean;
    isCurrentUser: boolean;
    joinedAt: string;
    memberships: {
      id: string;
      company_id: string;
      roles?: string[];
      is_genesis: boolean;
      company?: { id: string; dic: string; legal_name?: string | null } | null;
    }[];
  };
  companyMap: Record<string, string>;
  role: AppRole;
  onSelect: () => void;
}) {
  return (
    <div
      className="rounded-lg border p-4 transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Name + email */}
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {member.name ?? "Unnamed"}
            </span>
            {member.isCurrentUser && (
              <Badge variant="outline" className="text-xs shrink-0">you</Badge>
            )}
            {member.isSuperAdmin && (
              <Badge className="text-xs shrink-0">
                <Shield className="mr-1 h-3 w-3" />
                Super Admin
              </Badge>
            )}
          </div>
          {member.email && (
            <p className="text-sm text-muted-foreground truncate">{member.email}</p>
          )}

          {/* Company memberships */}
          <div className="mt-2 space-y-1.5">
            {member.memberships.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1 shrink-0">
                  {(m.roles ?? []).map((r) => (
                    <Badge key={r} className={cn("text-xs", ROLE_BADGE_COLORS[r] ?? "")}>
                      {roleLabel(r)}
                    </Badge>
                  ))}
                  {m.is_genesis && (
                    <Badge variant="secondary" className="text-xs">Genesis</Badge>
                  )}
                </div>
                <span className="text-muted-foreground truncate">
                  {m.company?.legal_name ?? m.company?.dic ?? companyMap[m.company_id] ?? "Unknown"}
                </span>
              </div>
            ))}
            {member.memberships.length === 0 && !member.isSuperAdmin && (
              <p className="text-xs text-muted-foreground">No company memberships</p>
            )}
          </div>
        </div>

        {/* Right side: status + date */}
        <div className="text-right shrink-0">
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Active
          </Badge>
          <p className="mt-1 text-xs text-muted-foreground">
            Joined {formatDate(member.joinedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

function InvitationCard({
  invitation,
  companyMap,
  role: viewerRole,
}: {
  invitation: {
    id: string;
    name: string | null;
    email: string;
    roles: string[];
    companyIds: string[];
    isGenesis: boolean;
    sentAt: string;
    expiresAt: string;
  };
  companyMap: Record<string, string>;
  role: AppRole;
}) {
  return (
    <div className="rounded-lg border border-dashed border-yellow-300 bg-yellow-50/50 p-4 dark:border-yellow-800 dark:bg-yellow-950/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{invitation.email}</span>
          </div>

          <div className="mt-2 space-y-1">
            {invitation.companyIds.map((cid) => (
              <div key={cid} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-xs shrink-0">
                  {invitation.roles.map(roleLabel).join(", ")}
                  {invitation.isGenesis && " (genesis)"}
                </Badge>
                <span className="text-muted-foreground truncate">
                  {companyMap[cid] ?? cid.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side: status + actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
          <p className="text-xs text-muted-foreground">
            Sent {timeAgo(invitation.sentAt)}
          </p>
          <div className="flex items-center gap-1">
            <ResendInvitationButton invitationId={invitation.id} />
            <RevokeInvitationButton invitationId={invitation.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Invitations Tab — full log
// ============================================================

function InvitationsTab({
  invitations,
  companyMap,
  role,
}: {
  invitations: InvitationEntry[];
  companyMap: Record<string, string>;
  role: AppRole;
}) {
  const now = new Date();

  if (invitations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Mail className="h-12 w-12" />
        <p className="text-lg">No invitations sent</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Companies</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Sent</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((inv) => {
            const isAccepted = !!inv.accepted_at;
            const isExpired = !inv.accepted_at && new Date(inv.expires_at) < now;
            const isPending = !isAccepted && !isExpired;

            return (
              <TableRow key={inv.id}>
                <TableCell className="text-sm font-medium">{inv.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {inv.roles.map(roleLabel).join(", ")}
                    {inv.is_genesis && " (genesis)"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {inv.company_ids.map((cid) => (
                      <Badge key={cid} variant="secondary" className="text-xs">
                        {companyMap[cid] ?? cid.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {isAccepted ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Accepted
                    </Badge>
                  ) : isExpired ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">
                  {formatDate(inv.created_at)}
                </TableCell>
                <TableCell>
                  {isPending && (
                    <div className="flex items-center gap-1">
                      <ResendInvitationButton invitationId={inv.id} />
                      <RevokeInvitationButton invitationId={inv.id} />
                    </div>
                  )}
                  {isExpired && (
                    <ResendInvitationButton invitationId={inv.id} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/types";
import {
  Building2,
  Plus,
  X,
  Search,
  Shield,
  Check,
  Loader2,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { assignUserToCompany, deactivateMembership } from "@/lib/actions";
import { updateMemberRoles } from "@/app/dashboard/companies/[id]/company-actions";
import type { AppRole, Company, CompanyRole } from "@/lib/types";

interface Membership {
  id: string;
  company_id: string;
  roles?: string[];
  is_genesis: boolean;
  status: string;
  company?: { id: string; dic: string; legal_name?: string | null } | null;
}

interface UserDetail {
  id: string;
  name: string | null;
  email: string | null;
  isSuperAdmin: boolean;
  isCurrentUser: boolean;
  joinedAt: string;
  memberships: Membership[];
}

interface Props {
  user: UserDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  viewerRole: AppRole;
}

const AVAILABLE_ROLES: CompanyRole[] = ["company_admin", "operator", "processor"];

export function UserDetailDrawer({
  user,
  open,
  onOpenChange,
  companies,
  viewerRole,
}: Props) {
  if (!user) return null;

  const assignedCompanyIds = new Set(
    user.memberships.map((m) => m.company_id)
  );

  // Companies the viewer can assign this user to (ones the user is NOT already in)
  const assignableCompanies = companies.filter(
    (c) => !assignedCompanyIds.has(c.id)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {user.name ?? "Unnamed"}
            {user.isSuperAdmin && (
              <Badge className="text-xs">
                <Shield className="mr-1 h-3 w-3" />
                Super Admin
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          {/* Company Assignments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Company Assignments ({user.memberships.length})
              </h3>
            </div>

            {user.memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No company assignments
              </p>
            ) : (
              <div className="space-y-2">
                {user.memberships.map((m) => (
                  <MembershipRow
                    key={m.id}
                    membership={m}
                    viewerRole={viewerRole}
                    isCurrentUser={user.isCurrentUser}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Assign to Company */}
          {assignableCompanies.length > 0 && !user.isCurrentUser && (
            <AssignToCompany
              userId={user.id}
              companies={assignableCompanies}
              onAssigned={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Single membership row with remove action
// ============================================================

function MembershipRow({
  membership,
  viewerRole,
  isCurrentUser,
}: {
  membership: Membership;
  viewerRole: AppRole;
  isCurrentUser: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editRoles, setEditRoles] = useState<Set<string>>(
    new Set(membership.roles ?? [])
  );
  const { toast } = useToast();

  const companyName =
    membership.company?.legal_name ?? membership.company?.dic ?? "Unknown";

  const canEdit =
    !isCurrentUser &&
    (viewerRole === "super_admin" || viewerRole === "company_admin");

  const canRemove = canEdit && !membership.is_genesis;

  const handleRemove = () => {
    startTransition(async () => {
      const result = await deactivateMembership(membership.id);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(`Removed from ${companyName}`);
      }
    });
  };

  const toggleEditRole = (role: string) => {
    setEditRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        if (next.size > 1) next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleSaveRoles = () => {
    startTransition(async () => {
      const result = await updateMemberRoles(
        membership.id,
        Array.from(editRoles)
      );
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(`Roles updated for ${companyName}`);
        setIsEditing(false);
      }
    });
  };

  const handleCancelEdit = () => {
    setEditRoles(new Set(membership.roles ?? []));
    setIsEditing(false);
  };

  // Check if roles actually changed
  const currentRoles = new Set(membership.roles ?? []);
  const rolesChanged =
    editRoles.size !== currentRoles.size ||
    [...editRoles].some((r) => !currentRoles.has(r));

  return (
    <div className="rounded-lg border p-3 group">
      <div className="flex items-start gap-3">
        <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{companyName}</p>

          {!isEditing ? (
            /* View mode */
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {(membership.roles ?? []).map((r) => (
                <span
                  key={r}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    ROLE_COLORS[r] ?? ""
                  )}
                >
                  {ROLE_LABELS[r] ?? r}
                </span>
              ))}
              {membership.is_genesis && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  Genesis
                </Badge>
              )}
            </div>
          ) : (
            /* Edit mode — toggleable role badges */
            <div className="flex flex-wrap gap-1.5 mt-2">
              {AVAILABLE_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => toggleEditRole(role)}
                  disabled={isPending}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                    editRoles.has(role)
                      ? cn("border-transparent", ROLE_COLORS[role])
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {editRoles.has(role) && (
                    <Check className="mr-1 h-3 w-3 inline" />
                  )}
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {canEdit && !isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
              disabled={isPending}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {canRemove && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleRemove}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Edit mode save/cancel */}
      {isEditing && (
        <div className="flex items-center gap-2 mt-2 ml-7">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSaveRoles}
            disabled={isPending || !rolesChanged}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Check className="mr-1 h-3 w-3" />
            )}
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCancelEdit}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Assign to Company — searchable company list + role picker
// ============================================================

function AssignToCompany({
  userId,
  companies,
  onAssigned,
}: {
  userId: string;
  companies: Company[];
  onAssigned: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
    new Set(["processor"])
  );
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const filteredCompanies = useMemo(() => {
    if (!search) return companies;
    const lower = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.legal_name?.toLowerCase().includes(lower) ||
        c.dic.toLowerCase().includes(lower)
    );
  }, [companies, search]);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        if (next.size > 1) next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleAssign = () => {
    if (!selectedCompany) return;
    startTransition(async () => {
      const result = await assignUserToCompany(
        userId,
        selectedCompany.id,
        Array.from(selectedRoles)
      );
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(`User assigned to ${selectedCompany.legal_name ?? selectedCompany.dic}`);
        setSelectedCompany(null);
        setSearch("");
        setIsOpen(false);
        onAssigned();
      }
    });
  };

  const reset = () => {
    setSelectedCompany(null);
    setSearch("");
    setSelectedRoles(new Set(["processor"]));
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Assign to Company
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Assign to Company</h4>
        <Button variant="ghost" size="icon-sm" onClick={reset}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Step 1: Pick company */}
      {!selectedCompany ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">
                No companies found
              </p>
            ) : (
              filteredCompanies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCompany(c)}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left"
                >
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {c.legal_name ?? c.dic}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-auto">
                    {c.dic}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Step 2: Pick roles and confirm */
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">
              {selectedCompany.legal_name ?? selectedCompany.dic}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto shrink-0"
              onClick={() => setSelectedCompany(null)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>

          {/* Role selection */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Roles
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedRoles.has(role)
                      ? cn("border-transparent", ROLE_COLORS[role])
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {selectedRoles.has(role) && (
                    <Check className="mr-1 h-3 w-3 inline" />
                  )}
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleAssign}
            disabled={isPending || selectedRoles.size === 0}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Assign
          </Button>
        </div>
      )}
    </div>
  );
}

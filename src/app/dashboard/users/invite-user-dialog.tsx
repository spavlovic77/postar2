"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/types";
import { inviteUser } from "@/lib/actions";
import type { Company } from "@/lib/types";
import { UserPlus } from "lucide-react";

const AVAILABLE_ROLES = ["company_admin", "operator", "processor"] as const;

interface Props {
  companies: Company[];
}

export function InviteUserDialog({ companies }: Props) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState<string>("");
  const router = useRouter();

  const toggleCompany = (id: string) => {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    for (const id of selectedCompanies) {
      formData.append("companyIds", id);
    }
    formData.set("role", selectedRole);

    const result = await inviteUser(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setOpen(false);
      setSelectedCompanies(new Set());
      setSelectedRole("");
      setIsLoading(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus className="mr-2 h-4 w-4" />
        Invite User
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation to join your company.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              placeholder="user@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {AVAILABLE_ROLES.map((role) => (
                <label
                  key={role}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md p-1.5 text-sm transition-colors hover:bg-muted",
                    selectedRole === role && "bg-muted"
                  )}
                >
                  <input
                    type="radio"
                    name="roleSelect"
                    checked={selectedRole === role}
                    onChange={() => setSelectedRole(role)}
                    disabled={isLoading}
                    className="accent-primary"
                  />
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", ROLE_COLORS[role])}>
                    {ROLE_LABELS[role]}
                  </span>
                </label>
              ))}
            </div>
            {!selectedRole && (
              <p className="text-xs text-muted-foreground">
                Select a role
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Companies</Label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
              {companies.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedCompanies.has(c.id)}
                    onChange={() => toggleCompany(c.id)}
                    disabled={isLoading}
                    className="rounded"
                  />
                  {c.legal_name ?? c.dic}
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {c.dic}
                  </span>
                </label>
              ))}
            </div>
            {selectedCompanies.size === 0 && (
              <p className="text-xs text-muted-foreground">
                Select at least one company
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || selectedCompanies.size === 0 || !selectedRole}
          >
            {isLoading ? "Sending..." : "Send Invitation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

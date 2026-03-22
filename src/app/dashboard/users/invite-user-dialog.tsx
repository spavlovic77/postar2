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
import { inviteUser } from "@/lib/actions";
import type { Company } from "@/lib/types";
import { UserPlus } from "lucide-react";

const AVAILABLE_ROLES = [
  { value: "company_admin", label: "Company Admin" },
  { value: "operator", label: "Operator" },
  { value: "processor", label: "Processor" },
];

interface Props {
  companies: Company[];
}

export function InviteUserDialog({ companies }: Props) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const router = useRouter();

  const toggleCompany = (id: string) => {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
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
    for (const role of selectedRoles) {
      formData.append("roles", role);
    }

    const result = await inviteUser(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setOpen(false);
      setSelectedCompanies(new Set());
      setSelectedRoles(new Set());
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
            <Label>Roles</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {AVAILABLE_ROLES.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.has(r.value)}
                    onChange={() => toggleRole(r.value)}
                    disabled={isLoading}
                    className="rounded"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            {selectedRoles.size === 0 && (
              <p className="text-xs text-muted-foreground">
                Select at least one role
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
            disabled={isLoading || selectedCompanies.size === 0 || selectedRoles.size === 0}
          >
            {isLoading ? "Sending..." : "Send Invitation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/types";
import { Pencil, Check } from "lucide-react";
import { updateMemberRole } from "./company-actions";

const AVAILABLE_ROLES = ["company_admin", "operator", "processor"] as const;

interface Props {
  membershipId: string;
  currentRole: string;
  memberName: string;
}

export function EditRoleDialog({ membershipId, currentRole, memberName }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSave = async () => {
    setIsLoading(true);
    const result = await updateMemberRole(membershipId, selectedRole);
    setIsLoading(false);

    if (result.error) {
      toast(result.error, "error");
    } else {
      toast(`Role updated for ${memberName}`);
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setSelectedRole(currentRole); }}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        title="Edit role"
      >
        <Pencil className="h-3 w-3" />
      </button>

      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Role — {memberName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {AVAILABLE_ROLES.map((role) => (
                <label
                  key={role}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted",
                    selectedRole === role && "ring-2 ring-primary"
                  )}
                >
                  <input
                    type="radio"
                    name="role"
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

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isLoading || selectedRole === currentRole}>
                  {isLoading ? "Saving..." : "Save Role"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

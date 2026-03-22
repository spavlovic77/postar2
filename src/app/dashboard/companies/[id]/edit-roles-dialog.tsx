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
import { Pencil } from "lucide-react";
import { updateMemberRoles } from "./company-actions";

const AVAILABLE_ROLES = [
  { value: "company_admin", label: "Company Admin" },
  { value: "operator", label: "Operator" },
  { value: "processor", label: "Processor" },
];

interface Props {
  membershipId: string;
  currentRoles: string[];
  memberName: string;
}

export function EditRolesDialog({ membershipId, currentRoles, memberName }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set(currentRoles));
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    const result = await updateMemberRoles(membershipId, Array.from(selectedRoles));
    setIsLoading(false);

    if (result.error) {
      toast(result.error, "error");
    } else {
      toast(`Roles updated for ${memberName}`);
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setSelectedRoles(new Set(currentRoles)); }}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        title="Edit roles"
      >
        <Pencil className="h-3 w-3" />
      </button>

      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Roles — {memberName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {AVAILABLE_ROLES.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.has(r.value)}
                    onChange={() => toggleRole(r.value)}
                    disabled={isLoading}
                    className="rounded"
                  />
                  <span className="font-medium">{r.label}</span>
                </label>
              ))}

              {selectedRoles.size === 0 && (
                <p className="text-xs text-destructive">Select at least one role</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isLoading || selectedRoles.size === 0}>
                  {isLoading ? "Saving..." : "Save Roles"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

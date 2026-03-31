"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { updateCompanyDetails } from "./company-actions";

interface Props {
  companyId: string;
  legalName: string;
  companyEmail: string;
  companyPhone: string;
  slaTriageHours: number;
  slaProcessHours: number;
}

export function EditCompanyDialog({
  companyId,
  legalName,
  companyEmail,
  companyPhone,
  slaTriageHours,
  slaProcessHours,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("companyId", companyId);

    const result = await updateCompanyDetails(formData);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Company Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Company Name</Label>
            <Input
              id="edit-name"
              name="legalName"
              defaultValue={legalName}
              placeholder="Company s.r.o."
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              name="companyEmail"
              type="email"
              defaultValue={companyEmail}
              placeholder="company@example.com"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              name="companyPhone"
              type="tel"
              defaultValue={companyPhone}
              placeholder="+421 9XX XXX XXX"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-sla-triage">Triage SLA (hours)</Label>
              <Input
                id="edit-sla-triage"
                name="slaTriageHours"
                type="number"
                min="1"
                defaultValue={slaTriageHours}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-sla-process">Process SLA (hours)</Label>
              <Input
                id="edit-sla-process"
                name="slaProcessHours"
                type="number"
                min="1"
                defaultValue={slaProcessHours}
                disabled={isLoading}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

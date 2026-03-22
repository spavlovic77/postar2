"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { RotateCcw } from "lucide-react";
import { reactivateCompany } from "./company-actions";

interface Props {
  companyId: string;
  dic: string;
  legalName: string;
  companyEmail: string;
}

export function ReactivateCompanyForm({
  companyId,
  dic,
  legalName,
  companyEmail,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const handleReactivate = async () => {
    if (!formRef.current) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData(formRef.current);
    formData.set("companyId", companyId);

    const result = await reactivateCompany(formData);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reactivate Company</CardTitle>
        <CardDescription>
          Re-register this company on the Peppol network and send a fresh genesis admin invitation.
          Review and edit the details below if needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="react-dic">DIC (read-only)</Label>
            <Input
              id="react-dic"
              value={dic}
              disabled
              className="bg-muted font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="react-peppol">Peppol Identifier (read-only)</Label>
            <Input
              id="react-peppol"
              value={`0245:${dic}`}
              disabled
              className="bg-muted font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="react-name">Company Name</Label>
            <Input
              id="react-name"
              name="legalName"
              defaultValue={legalName}
              placeholder="Company s.r.o."
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="react-company-email">Company Email</Label>
            <Input
              id="react-company-email"
              name="companyEmail"
              type="email"
              defaultValue={companyEmail}
              placeholder="company@example.com"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="react-genesis-email">Genesis Admin Email</Label>
            <Input
              id="react-genesis-email"
              name="genesisEmail"
              type="email"
              defaultValue={companyEmail}
              placeholder="admin@company.com"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              An invitation will be sent to this email as genesis company admin.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <ConfirmAction
            title="Reactivate Company"
            description="This will re-register the company on the Peppol network and send a genesis admin invitation."
            confirmLabel="Reactivate"
            onConfirm={handleReactivate}
            trigger={
              <Button type="button" disabled={isLoading}>
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                {isLoading ? "Reactivating..." : "Reactivate on Peppol"}
              </Button>
            }
          />
        </form>
      </CardContent>
    </Card>
  );
}

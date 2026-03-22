"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { activateCompanyOnPeppol } from "@/lib/actions";
import { Zap } from "lucide-react";

export function PeppolActivateButton({ companyId }: { companyId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleActivate = async () => {
    setIsLoading(true);
    setError(null);

    const result = await activateCompanyOnPeppol(companyId);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      router.refresh();
    }
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ConfirmAction
        title="Activate on Peppol"
        description="Register this company on the Peppol network. It will become discoverable for receiving invoices."
        confirmLabel="Activate"
        onConfirm={handleActivate}
        trigger={
          <Button disabled={isLoading}>
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Activating..." : "Activate on Peppol"}
          </Button>
        }
      />
    </div>
  );
}

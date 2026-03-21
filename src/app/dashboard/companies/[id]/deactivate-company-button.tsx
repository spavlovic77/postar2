"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deactivateCompany } from "@/lib/actions";
import { ShieldOff } from "lucide-react";

export function DeactivateCompanyButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDeactivate = async () => {
    const confirmed = confirm(
      `Are you sure you want to deactivate "${companyName}"?\n\n` +
      "This will:\n" +
      "- Remove the company from the Peppol network (SMP)\n" +
      "- Deactivate all company members\n" +
      "- Archive all documents\n\n" +
      "This action is NOT reversible. The company must go through onboarding again."
    );

    if (!confirmed) return;

    setIsLoading(true);
    setError(null);

    const result = await deactivateCompany(companyId);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      router.push("/dashboard/companies");
      router.refresh();
    }
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        variant="destructive"
        onClick={handleDeactivate}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <ShieldOff className="mr-2 h-4 w-4" />
        )}
        {isLoading ? "Deactivating..." : "Deactivate Company"}
      </Button>
    </div>
  );
}

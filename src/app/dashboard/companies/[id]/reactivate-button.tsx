"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { reactivateMembership } from "@/lib/actions";

export function ReactivateButton({ membershipId }: { membershipId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleReactivate = async () => {
    setIsLoading(true);
    setError(null);
    const result = await reactivateMembership(membershipId);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ConfirmAction
        title="Reactivate Member"
        description="This member will regain access to this company with their original roles."
        confirmLabel="Reactivate"
        onConfirm={handleReactivate}
        trigger={
          <Button variant="outline" size="sm" disabled={isLoading}>
            {isLoading ? "..." : "Reactivate"}
          </Button>
        }
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { deactivateMembership } from "@/lib/actions";

export function DeactivateButton({ membershipId }: { membershipId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  const handleDeactivate = async () => {
    setIsLoading(true);
    setError(null);
    const result = await deactivateMembership(membershipId);
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
      title="Deactivate Member"
      description="This member will lose access to this company. Are you sure?"
      confirmLabel="Deactivate"
      confirmVariant="destructive"
      onConfirm={handleDeactivate}
      trigger={
        <Button variant="destructive" size="sm" disabled={isLoading}>
          {isLoading ? "..." : "Deactivate"}
        </Button>
      }
    />
    </>
  );
}

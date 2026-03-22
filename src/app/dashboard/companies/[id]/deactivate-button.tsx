"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { deactivateMembership } from "@/lib/actions";

export function DeactivateButton({ membershipId }: { membershipId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleDeactivate = async () => {
    setIsLoading(true);
    const result = await deactivateMembership(membershipId);
    setIsLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  return (
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
  );
}

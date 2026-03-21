"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deactivateMembership } from "@/lib/actions";

export function DeactivateButton({ membershipId }: { membershipId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleDeactivate = async () => {
    if (!confirm("Are you sure you want to deactivate this member?")) return;

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
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDeactivate}
      disabled={isLoading}
    >
      {isLoading ? "..." : "Deactivate"}
    </Button>
  );
}

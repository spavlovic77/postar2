"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { revokeInvitation } from "@/lib/actions";
import { XCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleRevoke = async () => {
    setIsLoading(true);
    const result = await revokeInvitation(invitationId);
    setIsLoading(false);

    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("Invitation revoked");
      router.refresh();
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRevoke}
      disabled={isLoading}
      className="text-muted-foreground hover:text-destructive"
    >
      {isLoading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

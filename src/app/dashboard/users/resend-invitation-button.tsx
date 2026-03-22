"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resendInvitation } from "@/lib/actions";
import { RefreshCw } from "lucide-react";

export function ResendInvitationButton({ invitationId }: { invitationId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const handleResend = async () => {
    setIsLoading(true);
    const result = await resendInvitation(invitationId);
    setIsLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      setSent(true);
      router.refresh();
    }
  };

  if (sent) {
    return <span className="text-xs text-green-600">Sent!</span>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleResend}
      disabled={isLoading}
    >
      {isLoading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <RefreshCw className="mr-1 h-3.5 w-3.5" />
      )}
      {isLoading ? "" : "Resend"}
    </Button>
  );
}

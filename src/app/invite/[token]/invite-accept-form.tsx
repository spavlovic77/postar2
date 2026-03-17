"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthForm } from "@/components/auth-form";

interface Props {
  token: string;
  isSignedIn: boolean;
  emailMatch: boolean;
  inviteEmail: string;
}

export function InviteAcceptForm({ token, isSignedIn, emailMatch, inviteEmail }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAccept = async () => {
    setIsLoading(true);
    setError(null);

    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setIsLoading(false);
      return;
    }

    router.push("/");
  };

  if (!isSignedIn) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          Sign in with <strong>{inviteEmail}</strong> to accept this invitation.
        </p>
        <AuthForm
          redirectTo={`/invite/${token}`}
          onSignedIn={() => router.refresh()}
        />
      </div>
    );
  }

  if (!emailMatch) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive">
          This invitation was sent to <strong>{inviteEmail}</strong>. Please sign in with
          that email address.
        </p>
        <AuthForm
          redirectTo={`/invite/${token}`}
          onSignedIn={() => router.refresh()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
      <Button
        className="w-full"
        size="lg"
        onClick={handleAccept}
        disabled={isLoading}
      >
        {isLoading ? "Accepting..." : "Accept Invitation"}
      </Button>
    </div>
  );
}

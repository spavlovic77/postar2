"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

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

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/invite/${token}`,
      },
    });
  };

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
      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Sign in with <strong>{inviteEmail}</strong> to accept this invitation.
        </p>
        <Button className="w-full" size="lg" onClick={handleSignIn}>
          Sign In to Accept
        </Button>
      </div>
    );
  }

  if (!emailMatch) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-destructive">
          This invitation was sent to <strong>{inviteEmail}</strong>. Please sign in with
          that email address.
        </p>
        <Button className="w-full" variant="outline" size="lg" onClick={handleSignIn}>
          Switch Account
        </Button>
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

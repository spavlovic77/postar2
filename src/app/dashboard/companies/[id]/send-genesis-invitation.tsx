"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { sendGenesisInvitation } from "@/lib/actions";

interface Props {
  companyId: string;
  defaultEmail: string;
}

export function SendGenesisInvitation({ companyId, defaultEmail }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    formData.set("companyId", companyId);

    const result = await sendGenesisInvitation(formData);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      router.refresh();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Genesis Admin Invitation</CardTitle>
        <CardDescription>
          Send or resend a genesis admin invitation for this company.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="genesis-email">Genesis admin email</Label>
            <Input
              id="genesis-email"
              name="email"
              type="email"
              defaultValue={defaultEmail}
              placeholder="admin@company.com"
              required
              disabled={isLoading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">Invitation sent!</p>}

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Sending..." : "Send Genesis Invitation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

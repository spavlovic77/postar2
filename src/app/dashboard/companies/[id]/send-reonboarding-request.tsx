"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Send } from "lucide-react";
import { sendReonboardingRequest } from "./company-actions";

interface Props {
  companyId: string;
  companyName: string;
  defaultEmail: string;
}

export function SendReonboardingRequest({ companyId, companyName, defaultEmail }: Props) {
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

    const result = await sendReonboardingRequest(formData);

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
        <CardTitle>Request Re-onboarding</CardTitle>
        <CardDescription>
          Send an email to the genesis admin requesting them to visit the PFS portal
          and trigger the webhook to re-onboard {companyName}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="recipientEmail">Send to (genesis admin email)</Label>
            <Input
              id="recipientEmail"
              name="recipientEmail"
              type="email"
              defaultValue={defaultEmail}
              placeholder="admin@company.com"
              required
              disabled={isLoading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-green-600">
              Re-onboarding request sent successfully.
            </p>
          )}

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Sending..." : "Send Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Send } from "lucide-react";
import { sendOnboardingRequest } from "./send-onboarding-action";

export function SendOnboardingRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const result = await sendOnboardingRequest(formData);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Onboarding Request</CardTitle>
        <CardDescription>
          Send a customer the PFS portal link so they can register their company.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="onboard-email">Customer email</Label>
            <Input
              id="onboard-email"
              name="recipientEmail"
              type="email"
              placeholder="customer@company.com"
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-name">Company name (optional)</Label>
            <Input
              id="onboard-name"
              name="companyName"
              type="text"
              placeholder="Company s.r.o."
              disabled={isLoading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-green-600">Onboarding request sent.</p>
          )}

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Sending..." : "Send Onboarding Link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

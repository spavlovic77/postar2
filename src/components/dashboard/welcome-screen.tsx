"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeOnboarding } from "@/lib/actions";
import type { AppRole, Company } from "@/lib/types";

interface Props {
  fullName: string | null;
  role: AppRole;
  companies: Company[];
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  company_admin: "Company Admin",
  operator: "Operator",
  processor: "Processor",
};

export function WelcomeScreen({ fullName, role, companies }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setIsLoading(true);
    await completeOnboarding();
    // Hard navigation to bypass Next.js cache
    window.location.href = "/dashboard";
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to peppolbox.sk{fullName ? `, ${fullName}` : ""}!
        </h1>
        <Badge variant="secondary" className="text-sm">
          {ROLE_LABELS[role]}
        </Badge>

        {companies.length > 0 && (
          <div className="space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">Your companies:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {companies.map((c) => (
                <Badge key={c.id} variant="outline">
                  {c.legal_name ?? c.dic}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button size="lg" onClick={handleClick} disabled={isLoading}>
        {isLoading ? "Loading..." : "Go to Dashboard"}
      </Button>
    </div>
  );
}

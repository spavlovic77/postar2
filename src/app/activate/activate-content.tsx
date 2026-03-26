"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { activateCompanyOnPeppol } from "@/lib/actions";

type Status = "activating" | "success" | "error";

export function ActivateContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("company");
  const companyName = searchParams.get("name");

  const [status, setStatus] = useState<Status>("activating");
  const [peppolId, setPeppolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setStatus("error");
      setError("Missing company information.");
      return;
    }

    let cancelled = false;

    async function activate() {
      const result = await activateCompanyOnPeppol(companyId!);
      if (cancelled) return;

      if (result.error) {
        setStatus("error");
        setError(result.error);
      } else {
        setStatus("success");
        setPeppolId(result.peppolId ?? null);
      }
    }

    activate();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg text-center space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">peppolbox.sk</h1>

        {status === "activating" && (
          <>
            <div className="flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                Activating{companyName ? ` ${companyName}` : " your company"} on Peppol
              </h2>
              <p className="text-sm text-muted-foreground">
                Registering on the Peppol network so you can receive electronic invoices. This may take a few seconds...
              </p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <svg
                  className="h-7 w-7 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                {companyName ? `${companyName} is` : "Your company is"} now active on Peppol!
              </h2>
              {peppolId && (
                <p className="text-sm font-mono bg-muted rounded-md px-3 py-1.5 inline-block">
                  {peppolId}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                You can now receive electronic invoices via the Peppol network.
                You will receive email notifications when new invoices arrive in your inbox.
              </p>
            </div>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to Dashboard
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg
                  className="h-7 w-7 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Activation failed</h2>
              <p className="text-sm text-muted-foreground">
                {error ?? "Something went wrong while activating on Peppol."}
              </p>
              <p className="text-sm text-muted-foreground">
                Don&apos;t worry — your account is ready. A peppolbox.sk administrator can retry the activation for you.
              </p>
            </div>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to Dashboard
            </a>
          </>
        )}
      </div>
    </div>
  );
}

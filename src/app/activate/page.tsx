import { Suspense } from "react";
import { ActivateContent } from "./activate-content";

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg text-center space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">peppolbox.sk</h1>
            <div className="flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <ActivateContent />
    </Suspense>
  );
}

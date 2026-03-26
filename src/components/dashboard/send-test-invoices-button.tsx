"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { sendTestInvoices } from "@/lib/test-invoices-action";
import { Mail } from "lucide-react";

export function SendTestInvoicesButton({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSend = async () => {
    setIsLoading(true);
    setResult(null);

    const res = await sendTestInvoices(companyId);

    if (res.error) {
      setResult({ type: "error", message: res.error });
    } else {
      setResult({
        type: "success",
        message: `${res.sent} test invoices sent! They will appear in your inbox shortly.`,
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-2">
      <ConfirmAction
        title="Send test invoices"
        description={`This will send 3 real Peppol invoices to ${companyName}. They will arrive in the inbox within a few seconds.`}
        confirmLabel="Send 3 invoices"
        loadingLabel="Sending..."
        onConfirm={handleSend}
        trigger={
          <Button variant="outline" size="sm" disabled={isLoading}>
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Sending..." : "Send test invoices"}
          </Button>
        }
      />
      {result && (
        <p
          className={`text-xs ${result.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

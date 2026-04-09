"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Undo2 } from "lucide-react";
import { issueRefund } from "./wallet-actions";

interface Props {
  walletId: string;
  balance: number;
  hasActiveCompanies: boolean;
}

const MIN_REFUND = 5.0;

export function RefundDialog({ walletId, balance, hasActiveCompanies }: Props) {
  const [open, setOpen] = useState(false);
  const [iban, setIban] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Eligibility
  const ineligibleReason = hasActiveCompanies
    ? "Refund is only available after all companies under this wallet have been deactivated."
    : balance < MIN_REFUND
    ? `Wallet balance must be at least ${MIN_REFUND.toFixed(2)} EUR (current: ${balance.toFixed(2)} EUR).`
    : null;

  const eligible = !ineligibleReason;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iban.trim() || !note.trim() || !confirmed) return;
    setIsLoading(true);
    const result = await issueRefund(walletId, iban.trim(), note.trim());
    setIsLoading(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast(`Refunded ${result.refundedAmount?.toFixed(2)} EUR`);
      setOpen(false);
      setIban("");
      setNote("");
      setConfirmed(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={!eligible}
            title={ineligibleReason ?? "Issue refund to customer"}
          >
            <Undo2 className="mr-2 h-3.5 w-3.5" />
            Issue Refund
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Refund</DialogTitle>
          <DialogDescription>
            Refund the entire wallet balance to a customer's IBAN. The actual SEPA transfer must be
            performed manually outside this application — this action only records the obligation
            and decrements the wallet.
          </DialogDescription>
        </DialogHeader>

        {!eligible ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">{ineligibleReason}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Refundable amount</p>
              <p className="text-2xl font-bold">{balance.toFixed(2)} EUR</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refund-iban">IBAN</Label>
              <Input
                id="refund-iban"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="SK00 0000 0000 0000 0000 0000"
                disabled={isLoading}
                required
              />
              <p className="text-xs text-muted-foreground">Customer's bank account in EU/EEA</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refund-note">Note / Reason</Label>
              <textarea
                id="refund-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Customer closure request, ticket #123"
                rows={3}
                disabled={isLoading}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={isLoading}
                className="mt-0.5 rounded"
              />
              <span>
                I confirm the SEPA transfer of <strong>{balance.toFixed(2)} EUR</strong> will be
                executed manually outside this application.
              </span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !iban.trim() || !note.trim() || !confirmed}>
                {isLoading ? "Processing..." : "Issue Refund"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

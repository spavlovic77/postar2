"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { adjustWalletAction } from "./wallet-actions";

interface Props {
  walletId: string;
}

export function AdjustBalanceDialog({ walletId }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount === 0) {
      toast("Enter a non-zero amount", "error");
      return;
    }
    if (!description.trim()) {
      toast("Description is required", "error");
      return;
    }

    setIsLoading(true);
    const result = await adjustWalletAction(walletId, numAmount, description.trim());
    setIsLoading(false);

    if (result.error) {
      toast(result.error, "error");
    } else {
      toast(`Balance adjusted by ${numAmount > 0 ? "+" : ""}${numAmount.toFixed(4)} EUR`);
      setOpen(false);
      setAmount("");
      setDescription("");
      window.location.reload();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="mt-2">
          Adjust Balance
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Wallet Balance</DialogTitle>
          <DialogDescription>
            Add or remove funds manually. Use positive values to credit, negative to debit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Amount (EUR)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="+10.00 or -5.00"
              step="0.01"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Manual top-up via bank transfer"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Adjusting..." : "Apply Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

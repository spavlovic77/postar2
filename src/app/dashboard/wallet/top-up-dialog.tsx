"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Props {
  walletId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function TopUpDialog({ walletId, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState<{
    id: string;
    paymeUrl: string;
    transactionId: string;
  } | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsMobile(/iphone|ipad|ipod|android/i.test(navigator.userAgent));
  }, []);

  // Poll for payment confirmation
  useEffect(() => {
    if (!paymentLink || isConfirmed) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/wallet/check-payment?paymentLinkId=${paymentLink.id}`);
        const data = await res.json();
        if (data.confirmed) {
          setIsConfirmed(true);
          if (pollingRef.current) clearInterval(pollingRef.current);
          toast("Payment received! Balance updated.");
          setTimeout(onSuccess, 1500);
        }
      } catch {
        // Silently retry
      }
    };

    // First check immediately, then every 4 seconds
    poll();
    pollingRef.current = setInterval(poll, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [paymentLink, isConfirmed]);

  const handleGenerate = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 0.50 || numAmount > 100) {
      toast("Enter an amount between 0.50 and 100 EUR", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/wallet/create-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId, amount: numAmount }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Failed to generate payment link", "error");
        return;
      }

      setPaymentLink({
        id: data.paymentLinkId,
        paymeUrl: data.paymeUrl,
        transactionId: data.transactionId,
      });
    } catch {
      toast("Failed to generate payment link", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top Up Wallet</DialogTitle>
          <DialogDescription>
            {!paymentLink
              ? "Enter the amount you want to add to your wallet balance."
              : "Scan the QR code or open your banking app to complete the payment."}
          </DialogDescription>
        </DialogHeader>

        {isConfirmed ? (
          <div className="text-center space-y-2 py-6">
            <div className="text-5xl text-green-600">&#10003;</div>
            <p className="text-lg font-semibold text-green-600">Payment Received!</p>
            <p className="text-sm text-muted-foreground">
              {parseFloat(amount).toFixed(2)} EUR has been added to your wallet.
            </p>
          </div>
        ) : !paymentLink ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount (EUR)</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.50"
                step="0.01"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={isLoading}>
                {isLoading ? "Generating..." : "Generate Payment"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Amount to pay</p>
              <p className="text-3xl font-bold">{parseFloat(amount).toFixed(2)} EUR</p>
            </div>

            <div className="flex items-center gap-2 justify-center">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">Waiting for payment...</span>
            </div>

            {isMobile ? (
              <a
                href={paymentLink.paymeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button className="w-full" size="lg">
                  Open Banking App
                </Button>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymentLink.paymeUrl)}`}
                  alt="Payment QR Code"
                  className="w-64 h-64 rounded-lg border"
                />
                <p className="text-sm text-muted-foreground">
                  Scan with your banking app
                </p>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Transaction: {paymentLink.transactionId}
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  paymentLinkId: string;
  amount: number;
  paymeUrl: string | null;
  transactionId: string;
}

export function PublicPaymentView({ paymentLinkId, amount, paymeUrl, transactionId }: Props) {
  const [status, setStatus] = useState<"pending" | "completed">("pending");
  const [isMobile, setIsMobile] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIsMobile(/iphone|ipad|ipod|android/i.test(navigator.userAgent));
  }, []);

  // Poll for payment confirmation
  useEffect(() => {
    if (status === "completed") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/wallet/check-payment?paymentLinkId=${paymentLinkId}`);
        const data = await res.json();
        if (data.confirmed) {
          setStatus("completed");
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Silently retry
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [paymentLinkId, status]);

  if (status === "completed") {
    return (
      <div className="text-center space-y-2 py-4">
        <div className="text-4xl text-green-600">&#10003;</div>
        <p className="text-lg font-semibold text-green-600">Payment Received!</p>
        <p className="text-sm text-muted-foreground">
          {amount.toFixed(2)} EUR has been credited to the account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">Amount to pay</p>
        <p className="text-4xl font-bold">{amount.toFixed(2)} EUR</p>
      </div>

      <div className="flex items-center gap-2 justify-center">
        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-sm text-muted-foreground">Waiting for payment...</span>
      </div>

      {paymeUrl && (
        <div className="space-y-3">
          {isMobile ? (
            <a
              href={paymeUrl}
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
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymeUrl)}`}
                alt="Payment QR Code"
                className="w-64 h-64 rounded-lg border"
              />
              <p className="text-sm text-muted-foreground">
                Scan with your banking app
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        Transaction: {transactionId}
      </p>
    </div>
  );
}

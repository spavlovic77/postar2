"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { TopUpDialog } from "./top-up-dialog";

interface Props {
  balance: number;
  walletId: string;
  isOwner: boolean;
}

export function WalletBalanceCard({ balance, walletId, isOwner }: Props) {
  const [showTopUp, setShowTopUp] = useState(false);

  return (
    <>
      <Card className="sm:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Wallet className="h-4 w-4" />
            Available Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {balance.toFixed(2)} <span className="text-lg text-muted-foreground">EUR</span>
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => setShowTopUp(true)}
          >
            Top Up
          </Button>
        </CardContent>
      </Card>

      {showTopUp && (
        <TopUpDialog
          walletId={walletId}
          onClose={() => setShowTopUp(false)}
          onSuccess={() => {
            setShowTopUp(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

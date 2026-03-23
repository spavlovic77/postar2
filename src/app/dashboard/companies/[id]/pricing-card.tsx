"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateCompanyPricing } from "./company-actions";

interface Props {
  companyId: string;
  pricePerDocument: number | null;
}

export function PricingCard({ companyId, pricePerDocument }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState(pricePerDocument?.toString() ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast("Price must be a non-negative number", "error");
      return;
    }

    setIsLoading(true);
    const result = await updateCompanyPricing(companyId, numPrice);
    setIsLoading(false);

    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("Pricing updated");
      setIsEditing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Price per document</p>
            {!isEditing && (
              <p className="text-lg font-bold">
                {pricePerDocument != null ? `${pricePerDocument.toFixed(4)} EUR` : "Not set (free)"}
              </p>
            )}
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </div>

        {isEditing && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.0400"
              min="0"
              step="0.0001"
              className="w-32"
              autoFocus
            />
            <span className="text-sm text-muted-foreground">EUR</span>
            <Button size="sm" onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setPrice(pricePerDocument?.toString() ?? "");
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Each document received via Peppol for this company will be charged at this rate.
          Set to 0 for free. Documents received while pricing is not set are free.
        </p>
      </CardContent>
    </Card>
  );
}

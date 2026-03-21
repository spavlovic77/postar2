"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePfsActivationLink } from "./settings-actions";

export function PfsActivationLinkForm({ currentLink }: { currentLink: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await updatePfsActivationLink(formData);

    setIsLoading(false);
    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Saved");
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pfsLink">Activation Link URL</Label>
        <Input
          id="pfsLink"
          name="pfsLink"
          type="url"
          defaultValue={currentLink}
          placeholder="https://kejwajsi.vercel.app/client?actlinkid=3030"
          disabled={isLoading}
        />
      </div>
      {message && (
        <p className={`text-sm ${message === "Saved" ? "text-green-600" : "text-destructive"}`}>
          {message}
        </p>
      )}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}

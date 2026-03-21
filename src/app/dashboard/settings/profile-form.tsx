"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions";

interface Props {
  fullName: string;
  phone: string;
  email: string;
}

export function ProfileForm({ fullName, phone, email }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateProfile(formData);

    setIsLoading(false);
    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Profile updated");
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email-display">Email</Label>
        <Input id="email-display" value={email} disabled className="bg-muted" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          placeholder="Your name"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone}
          placeholder="+421 9XX XXX XXX"
          disabled={isLoading}
        />
      </div>
      {message && (
        <p className={`text-sm ${message === "Profile updated" ? "text-green-600" : "text-destructive"}`}>
          {message}
        </p>
      )}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}

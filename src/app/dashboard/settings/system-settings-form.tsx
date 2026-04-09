"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSystemSettings } from "./settings-actions";

interface Setting {
  key: string;
  label: string;
  description: string;
  type?: "text" | "url" | "password";
}

const SETTINGS: Setting[] = [
  { key: "resend_from_email", label: "Sender Email", description: "From address for all outgoing emails", type: "text" },
  { key: "pfs_webhook_secret", label: "PFS Webhook Secret", description: "HMAC secret for PFS webhook (comma-separated for rotation)", type: "password" },
  { key: "pfs_activation_link", label: "PFS Activation Link", description: "URL sent to customers for PFS portal onboarding", type: "url" },
  { key: "ion_ap_base_url", label: "ion-AP Base URL", description: "ion-AP API URL (e.g. https://test.ion-ap.net)", type: "url" },
  { key: "ion_ap_api_token", label: "ion-AP API Token", description: "ion-AP super admin API token", type: "password" },
  { key: "twilio_phone_number", label: "Twilio Phone Number", description: "Phone number for SMS OTP", type: "text" },
  { key: "welcome_credit_amount", label: "Welcome Credit (EUR)", description: "Amount credited to wallet on first Peppol activation. Set to 0 to disable.", type: "text" },
];

interface Props {
  currentValues: Record<string, string>;
}

export function SystemSettingsForm({ currentValues }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateSystemSettings(formData);

    setIsLoading(false);
    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Settings saved");
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {SETTINGS.map((setting) => (
        <div key={setting.key} className="space-y-1.5">
          <Label htmlFor={`sys-${setting.key}`}>{setting.label}</Label>
          <Input
            id={`sys-${setting.key}`}
            name={setting.key}
            type={setting.type ?? "text"}
            defaultValue={currentValues[setting.key] ?? ""}
            placeholder={setting.description ?? ""}
            disabled={isLoading}
          />
          {setting.description && (
            <p className="text-xs text-muted-foreground">{setting.description}</p>
          )}
        </div>
      ))}

      {message && (
        <p className={`text-sm ${message === "Settings saved" ? "text-green-600" : "text-destructive"}`}>
          {message}
        </p>
      )}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save System Settings"}
      </Button>
    </form>
  );
}

import { Webhook } from "lucide-react";

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Webhooks Log</h1>
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Webhook className="h-8 w-8" />
        <p>Webhooks log coming soon</p>
      </div>
    </div>
  );
}

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Settings className="h-8 w-8" />
        <p>Settings coming soon</p>
      </div>
    </div>
  );
}

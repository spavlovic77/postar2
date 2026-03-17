import { Building2 } from "lucide-react";

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Companies</h1>
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Building2 className="h-8 w-8" />
        <p>Companies management coming soon</p>
      </div>
    </div>
  );
}

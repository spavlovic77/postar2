import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Company } from "@/lib/types";

interface Props {
  companies: Company[];
}

export function ProcessorDashboard({ companies }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {c.legal_name ?? c.dic}
              </CardTitle>
              <p className="font-mono text-xs text-muted-foreground">
                DIC: {c.dic}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {c.company_email ?? "No email"}
              </p>
            </CardContent>
          </Card>
        ))}

        {companies.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Building2 className="h-8 w-8" />
            <p>No companies assigned yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

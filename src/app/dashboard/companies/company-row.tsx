"use client";

import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Users, ChevronRight } from "lucide-react";
import { PeppolStatusBadge } from "@/components/dashboard/peppol-status-badge";
import type { Company } from "@/lib/types";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Props {
  company: Company;
  memberCount: number;
}

export function CompanyRow({ company, memberCount }: Props) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => router.push(`/dashboard/companies/${company.id}`)}
    >
      <TableCell className="font-medium">{company.legal_name ?? "-"}</TableCell>
      <TableCell className="font-mono text-sm">{company.dic}</TableCell>
      <TableCell>
        <PeppolStatusBadge status={company.ion_ap_status} />
      </TableCell>
      <TableCell className="hidden text-sm md:table-cell">
        {company.company_email ?? "-"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {memberCount}
        </div>
      </TableCell>
      <TableCell className="hidden text-sm lg:table-cell">
        {formatDate(company.created_at)}
      </TableCell>
      <TableCell>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

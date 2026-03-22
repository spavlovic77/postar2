"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Company } from "@/lib/types";

interface Props {
  companies: Company[];
}

export function CompanySwitcher({ companies }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentId = searchParams.get("company");

  const currentCompany = companies.find((c) => c.id === currentId);
  const displayName = currentCompany
    ? (currentCompany.legal_name ?? currentCompany.dic)
    : "All Companies";

  const handleSelect = (companyId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!companyId) {
      params.delete("company");
    } else {
      params.set("company", companyId);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  if (companies.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="outline" className="max-w-[200px] max-md:max-w-[140px]">
          <Building2 className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{displayName}</span>
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      } />
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuItem onClick={() => handleSelect(null)}>
          <Check className={cn("mr-2 h-4 w-4", !currentId ? "opacity-100" : "opacity-0")} />
          All Companies
        </DropdownMenuItem>
        {companies.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => handleSelect(c.id)}>
            <Check className={cn("mr-2 h-4 w-4", currentId === c.id ? "opacity-100" : "opacity-0")} />
            <span className="truncate">{c.legal_name ?? c.dic}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

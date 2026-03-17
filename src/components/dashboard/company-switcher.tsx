"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Company } from "@/lib/types";

interface Props {
  companies: Company[];
}

export function CompanySwitcher({ companies }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("company") ?? "all";

  const handleChange = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete("company");
    } else {
      params.set("company", value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  if (companies.length === 0) return null;

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px] max-md:w-[140px]">
        <SelectValue placeholder="All Companies" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Companies</SelectItem>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.legal_name ?? c.dic}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

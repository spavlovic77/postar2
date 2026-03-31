"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/types";
import type { AppRole } from "@/lib/types";

interface Props {
  role: AppRole;
}

export function RoleBadge({ role }: Props) {
  return (
    <Badge
      variant="secondary"
      className={cn("text-[11px] font-medium whitespace-nowrap max-md:hidden", ROLE_COLORS[role])}
    >
      {ROLE_LABELS[role]}
    </Badge>
  );
}

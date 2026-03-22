"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  total: number;
  pageSize: number;
  currentOffset: number;
}

export function PaginationControls({ total, pageSize, currentOffset }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Math.floor(currentOffset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  const navigate = (offset: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (offset === 0) {
      params.delete("offset");
    } else {
      params.set("offset", String(offset));
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const hasPrev = currentOffset > 0;
  const hasNext = currentOffset + pageSize < total;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {currentOffset + 1}–{Math.min(currentOffset + pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(Math.max(0, currentOffset - pageSize))}
          disabled={!hasPrev}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(currentOffset + pageSize)}
          disabled={!hasNext}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

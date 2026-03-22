"use client";

import { Button } from "@/components/ui/button";

interface Props {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  loadedCount: number;
  total: number;
}

export function LoadMore({ hasMore, isLoading, onLoadMore, loadedCount, total }: Props) {
  if (!hasMore) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <Button
        variant="outline"
        onClick={onLoadMore}
        disabled={isLoading}
        className="w-full max-w-xs"
      >
        {isLoading ? "Loading..." : "Load More"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Showing {loadedCount} of {total}
      </p>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function UsersLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-20" />
        <div className="rounded-lg border">
          <div className="space-y-1 p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

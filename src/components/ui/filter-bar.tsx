"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterDef {
  key: string;
  label: string;
  type: "search" | "select";
  options?: FilterOption[];
  placeholder?: string;
  allLabel?: string;
}

interface Props {
  filters: FilterDef[];
}

export function FilterBar({ filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state for search inputs (debounced)
  const [searchValues, setSearchValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of filters) {
      initial[f.key] = searchParams.get(f.key) ?? "";
    }
    return initial;
  });

  const navigate = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset offset when filtering
      params.delete("offset");
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  // Debounce search inputs
  useEffect(() => {
    const timeout = setTimeout(() => {
      const searchFilters = filters.filter((f) => f.type === "search");
      const updates: Record<string, string> = {};
      let changed = false;
      for (const f of searchFilters) {
        const current = searchParams.get(f.key) ?? "";
        if (searchValues[f.key] !== current) {
          updates[f.key] = searchValues[f.key];
          changed = true;
        }
      }
      if (changed) navigate(updates);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchValues, filters, searchParams, navigate]);

  const handleSelectChange = (key: string, value: string) => {
    navigate({ [key]: value });
  };

  const clearAll = () => {
    const updates: Record<string, string> = {};
    for (const f of filters) {
      updates[f.key] = "";
    }
    setSearchValues((prev) => {
      const next = { ...prev };
      for (const f of filters) next[f.key] = "";
      return next;
    });
    navigate(updates);
  };

  const hasActiveFilters = filters.some(
    (f) => (searchParams.get(f.key) ?? "") !== ""
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        if (filter.type === "search") {
          return (
            <div key={filter.key} className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={filter.placeholder ?? filter.label}
                value={searchValues[filter.key] ?? ""}
                onChange={(e) =>
                  setSearchValues((prev) => ({
                    ...prev,
                    [filter.key]: e.target.value,
                  }))
                }
                className="h-9 w-[180px] pl-8 text-sm"
              />
            </div>
          );
        }

        if (filter.type === "select" && filter.options) {
          const current = searchParams.get(filter.key) ?? "";
          return (
            <select
              key={filter.key}
              value={current}
              onChange={(e) => handleSelectChange(filter.key, e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
            >
              <option value="">{filter.allLabel ?? `All ${filter.label.toLowerCase()}s`}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );
        }

        return null;
      })}

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}

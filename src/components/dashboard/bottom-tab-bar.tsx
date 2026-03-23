"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Building2,
  Users,
  Webhook,
  ScrollText,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavigationItem } from "@/lib/types";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Inbox,
  Building2,
  Users,
  Webhook,
  ScrollText,
  Settings,
  Wallet,
};

interface Props {
  items: NavigationItem[];
}

export function BottomTabBar({ items }: Props) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex h-12 items-center justify-around">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center p-3",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {Icon && <Icon className="h-5 w-5" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

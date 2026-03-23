"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
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

export function SidebarNav({ items }: Props) {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton isActive={isActive} render={<Link href={item.href} />}>
              {Icon && <Icon className="h-4 w-4" />}
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

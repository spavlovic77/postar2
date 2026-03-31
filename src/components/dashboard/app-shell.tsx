"use client";

import { useSearchParams } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { BottomTabBar } from "./bottom-tab-bar";
import { CompanySwitcher } from "./company-switcher";
import { RoleBadge } from "./role-badge";
import { ThemeToggle } from "./theme-toggle";
import { UserAvatar } from "./user-avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { getNavForRole, getRoleForCompany } from "@/lib/navigation";
import type { AppRole, CompanyMembership, NavigationItem, Company } from "@/lib/types";

interface Props {
  navItems: NavigationItem[];
  companies: Company[];
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: AppRole;
  memberships: CompanyMembership[];
  isSuperAdmin: boolean;
  children: React.ReactNode;
}

export function AppShell({
  navItems: defaultNavItems,
  companies,
  fullName,
  email,
  avatarUrl,
  role: globalRole,
  memberships,
  isSuperAdmin,
  children,
}: Props) {
  const searchParams = useSearchParams();
  const selectedCompanyId = searchParams.get("company");

  // Resolve role for selected company
  const activeRole = selectedCompanyId
    ? getRoleForCompany(memberships, selectedCompanyId, isSuperAdmin)
    : globalRole;

  // Recompute nav items based on active role
  const navItems = selectedCompanyId
    ? getNavForRole(activeRole)
    : defaultNavItems;

  return (
    <SidebarProvider>
      {/* Desktop sidebar */}
      <Sidebar className="max-md:hidden">
        <SidebarHeader className="p-4">
          <span className="text-lg font-bold">peppolbox.sk</span>
        </SidebarHeader>
        <SidebarContent className="px-2">
          <SidebarNav items={navItems} />
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        {/* Top bar */}
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <SidebarTrigger className="max-md:hidden" />
          <Separator orientation="vertical" className="h-5 max-md:hidden" />

          {/* Mobile logo */}
          <span className="text-lg font-bold md:hidden">Postar</span>

          <div className="flex-1" />
          <CompanySwitcher companies={companies} memberships={memberships} isSuperAdmin={isSuperAdmin} />
          <RoleBadge role={activeRole} />
          <ThemeToggle />
          <UserAvatar
            fullName={fullName}
            email={email}
            avatarUrl={avatarUrl}
            role={activeRole}
          />
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </main>
      </SidebarInset>

      {/* Mobile bottom tabs */}
      <BottomTabBar items={navItems} />
    </SidebarProvider>
  );
}

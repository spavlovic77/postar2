import type { AppRole, NavigationItem } from "./types";

const NAV_ITEMS: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    roles: ["super_admin", "company_admin", "operator", "processor"],
  },
  {
    label: "Inbox",
    href: "/dashboard/inbox",
    icon: "Inbox",
    roles: ["super_admin", "company_admin", "operator", "processor"],
  },
  {
    label: "Companies",
    href: "/dashboard/companies",
    icon: "Building2",
    roles: ["super_admin", "company_admin", "operator", "processor"],
  },
  {
    label: "Users",
    href: "/dashboard/users",
    icon: "Users",
    roles: ["super_admin", "company_admin", "operator"],
  },
  {
    label: "Webhooks",
    href: "/dashboard/webhooks",
    icon: "Webhook",
    roles: ["super_admin"],
  },
  {
    label: "Audit Log",
    href: "/dashboard/audit",
    icon: "ScrollText",
    roles: ["super_admin", "company_admin", "operator", "processor"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: "Settings",
    roles: ["super_admin", "company_admin", "operator", "processor"],
  },
];

export function getNavForRole(role: AppRole): NavigationItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

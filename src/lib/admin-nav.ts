import { canAccessSettings, type AdminV1Role } from "@/contracts/admin/roles";
import { routes } from "@/lib/navigation";

export type AdminNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

export const ADMIN_NAV_PRIMARY: readonly AdminNavItem[] = [
  { href: routes.admin, label: "Home", exact: true },
  { href: routes.adminOrders, label: "Orders" },
  { href: routes.adminProducts, label: "Products" },
  { href: routes.adminCollections, label: "Collections" },
  { href: routes.adminCustomers, label: "Customers" },
  { href: routes.adminAnalytics, label: "Analytics" },
];

export const ADMIN_NAV_SETTINGS: AdminNavItem = {
  href: routes.adminSettings,
  label: "Settings",
};

export function isAdminNavItemActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function adminNavForRole(role: AdminV1Role): {
  primary: readonly AdminNavItem[];
  settings: AdminNavItem | null;
} {
  return {
    primary: ADMIN_NAV_PRIMARY,
    settings: canAccessSettings(role) ? ADMIN_NAV_SETTINGS : null,
  };
}

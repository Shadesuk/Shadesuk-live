"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminV1Role } from "@/contracts/admin/roles";
import {
  ADMIN_NAV_SETTINGS,
  adminNavForRole,
  isAdminNavItemActive,
  type AdminNavItem,
} from "@/lib/admin-nav";
import { ADMIN_NAV_LABEL } from "@/lib/admin-copy";
import { cx } from "@/lib/cx";
import styles from "./AdminShell.module.css";

export function AdminNav({
  role,
  onNavigate,
}: {
  role: AdminV1Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const { primary, settings } = adminNavForRole(role);

  return (
    <nav className={styles.nav} aria-label={ADMIN_NAV_LABEL} data-admin-nav>
      <ul className={styles.list}>
        {primary.map((item) => (
          <AdminNavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      {settings ? (
        <>
          <div className={styles.rule} role="separator" />
          <ul className={styles.list}>
            <AdminNavLink
              item={ADMIN_NAV_SETTINGS}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          </ul>
        </>
      ) : null}
    </nav>
  );
}

function AdminNavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: AdminNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const current = isAdminNavItemActive(pathname, item);
  return (
    <li>
      <Link
        href={item.href}
        className={cx(styles.link, current && styles.current)}
        aria-current={current ? "page" : undefined}
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    </li>
  );
}


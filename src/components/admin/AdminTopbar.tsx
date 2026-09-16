"use client";

import type { AdminActor } from "@/lib/admin-session";
import {
  ADMIN_ALERTS_UNAVAILABLE,
  ADMIN_OPEN_MENU,
  ADMIN_SEARCH_UNAVAILABLE,
  ADMIN_SIGNED_IN_AS,
  ADMIN_TITLE,
} from "@/lib/admin-copy";
import { AdminSignOutButton } from "./AdminSignOutButton";
import styles from "./AdminShell.module.css";

export function AdminTopbar({
  actor,
  menuOpen,
  menuId,
  onOpenMenu,
}: {
  actor: AdminActor;
  menuOpen: boolean;
  menuId: string;
  onOpenMenu: () => void;
}) {
  const identity = actor.email || actor.roleLabel;

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarStart}>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-haspopup="dialog"
          aria-label={ADMIN_OPEN_MENU}
          onClick={onOpenMenu}
        >
          Menu
        </button>
        <p className={styles.topbarTitle}>{ADMIN_TITLE}</p>
      </div>
      <div className={styles.topbarEnd}>
        <button
          type="button"
          className={styles.placeholder}
          disabled
          aria-label={ADMIN_SEARCH_UNAVAILABLE}
        >
          Search
        </button>
        <button
          type="button"
          className={styles.placeholder}
          disabled
          aria-label={ADMIN_ALERTS_UNAVAILABLE}
        >
          Alerts
        </button>
        <div className={styles.profile}>
          <p className={styles.profileLabel}>
            <span className="visually-hidden">{ADMIN_SIGNED_IN_AS} </span>
            {identity}
          </p>
          <p className={styles.profileRole}>{actor.roleLabel}</p>
          <AdminSignOutButton />
        </div>
      </div>
    </header>
  );
}

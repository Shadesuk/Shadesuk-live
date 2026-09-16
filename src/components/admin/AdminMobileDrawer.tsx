"use client";

import { Drawer } from "@/components/ui/Drawer";
import type { AdminActor } from "@/lib/admin-session";
import {
  ADMIN_CLOSE_MENU,
  ADMIN_SIGNED_IN_AS,
  ADMIN_TITLE,
} from "@/lib/admin-copy";
import { AdminNav } from "./AdminNav";
import { AdminSignOutButton } from "./AdminSignOutButton";
import styles from "./AdminShell.module.css";

export function AdminMobileDrawer({
  actor,
  open,
  onClose,
  menuId,
  titleId,
}: {
  actor: AdminActor;
  open: boolean;
  onClose: () => void;
  menuId: string;
  titleId: string;
}) {
  return (
    <Drawer open={open} onClose={onClose} titleId={titleId} side="left" id={menuId}>
      <div className={styles.drawer}>
        <div className={styles.drawerToolbar}>
          <div>
            <p id={titleId} className={styles.brandName}>
              {ADMIN_TITLE}
            </p>
            <p className={styles.drawerIdentity}>
              {ADMIN_SIGNED_IN_AS} {actor.email || actor.roleLabel}
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={ADMIN_CLOSE_MENU}
          >
            Close
          </button>
        </div>
        <AdminNav role={actor.role} onNavigate={onClose} />
        <div className={styles.drawerFoot}>
          <AdminSignOutButton />
        </div>
      </div>
    </Drawer>
  );
}

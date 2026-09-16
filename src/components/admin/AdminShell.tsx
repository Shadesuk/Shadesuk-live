"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AdminActor } from "@/lib/admin-session";
import { AdminMobileDrawer } from "./AdminMobileDrawer";
import { AdminContent } from "./AdminContent";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import styles from "./AdminShell.module.css";

export function AdminShell({
  actor,
  children,
}: {
  actor: AdminActor;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [menuToken, setMenuToken] = useState<string | null>(null);
  const menuOpen = menuToken === pathname;
  const menuId = useId();
  const titleId = useId();

  const closeMenu = useCallback(() => {
    setMenuToken(null);
  }, []);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1200) {
        setMenuToken(null);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={styles.shell} data-admin-shell data-admin-role={actor.role}>
      <AdminSidebar role={actor.role} />
      <AdminTopbar
        actor={actor}
        menuOpen={menuOpen}
        menuId={menuId}
        onOpenMenu={() => setMenuToken(pathname)}
      />
      <main id="main" className={styles.content}>
        <AdminContent>{children}</AdminContent>
      </main>
      <AdminMobileDrawer
        actor={actor}
        open={menuOpen}
        onClose={closeMenu}
        menuId={menuId}
        titleId={titleId}
      />
    </div>
  );
}

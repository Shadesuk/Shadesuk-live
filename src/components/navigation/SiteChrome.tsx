"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { ChromeProvider } from "./ChromeContext";
import styles from "./SiteChrome.module.css";

export function SiteChrome({ children }: { children: ReactNode }) {
  const [pageLocked, setPageLocked] = useState(false);
  const value = useMemo(() => ({ setPageLocked }), []);

  return (
    <ChromeProvider value={value}>
      <div className={styles.shell}>
        <SiteHeader />
        <div className={styles.page} inert={pageLocked || undefined}>
          {children}
        </div>
        <div inert={pageLocked || undefined}>
          <SiteFooter />
        </div>
      </div>
    </ChromeProvider>
  );
}

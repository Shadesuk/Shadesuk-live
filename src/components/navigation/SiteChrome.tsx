"use client";

import { type ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { ChromeProvider, useChromeLocks } from "./ChromeContext";
import styles from "./SiteChrome.module.css";

export function SiteChrome({ children }: { children: ReactNode }) {
  const { pageLocked, value } = useChromeLocks();

  return (
    <ChromeProvider value={value}>
      <div className={styles.shell}>
        <div className={styles.lock} inert={pageLocked || undefined}>
          <SiteHeader />
          <div className={styles.page}>{children}</div>
          <SiteFooter />
        </div>
      </div>
    </ChromeProvider>
  );
}

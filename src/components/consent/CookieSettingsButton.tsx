"use client";

import { openCookieSettings } from "@/lib/cookie-consent";
import styles from "./CookieSettingsButton.module.css";

export function CookieSettingsButton() {
  return (
    <button type="button" className={styles.button} onClick={openCookieSettings}>
      Cookie settings
    </button>
  );
}

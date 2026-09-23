"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/account/SignOutButton";
import { NavLink } from "@/components/navigation/NavLink";
import { UtilityButton } from "@/components/navigation/UtilityButton";
import {
  ACCOUNT_MENU_LABEL,
  LOGIN_LABEL,
  LOG_OUT_LABEL,
  MY_ACCOUNT_LABEL,
  ORDERS_LABEL,
  TRACK_ORDER_LINK,
} from "@/lib/account-copy";
import { accountEntryHref } from "@/lib/auth-return";
import { routes } from "@/lib/navigation";
import styles from "./SiteHeader.module.css";

export function AccountMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const signInHref = accountEntryHref(pathname);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        wrapRef.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className={styles.account} ref={wrapRef}>
      <UtilityButton
        onClick={() => setOpen((current) => !current)}
        expanded={open}
        controls={menuId}
        hasPopup="menu"
      >
        {ACCOUNT_MENU_LABEL}
      </UtilityButton>
      {open ? (
        <div className={styles.accountMenu} id={menuId} aria-label={ACCOUNT_MENU_LABEL}>
          {signedIn ? (
            <>
              <NavLink href={routes.account} onClick={close}>
                {MY_ACCOUNT_LABEL}
              </NavLink>
              <NavLink href={routes.accountOrders} onClick={close}>
                {ORDERS_LABEL}
              </NavLink>
              <NavLink href={routes.trackOrder} onClick={close}>
                {TRACK_ORDER_LINK}
              </NavLink>
              <div className={styles.accountSignOut}>
                <SignOutButton label={LOG_OUT_LABEL} />
              </div>
            </>
          ) : (
            <>
              <NavLink href={signInHref} onClick={close}>
                {LOGIN_LABEL}
              </NavLink>
              <NavLink href={routes.accountOrders} onClick={close}>
                {ORDERS_LABEL}
              </NavLink>
              <NavLink href={routes.trackOrder} onClick={close}>
                {TRACK_ORDER_LINK}
              </NavLink>
              <NavLink href={signInHref} onClick={close}>
                {MY_ACCOUNT_LABEL}
              </NavLink>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

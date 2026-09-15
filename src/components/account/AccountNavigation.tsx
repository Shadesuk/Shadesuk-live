import Link from "next/link";
import { ACCOUNT_NAV, ACCOUNT_TITLE } from "@/lib/account-copy";
import { isCurrentPath } from "@/lib/navigation";
import styles from "./Account.module.css";

export function AccountNavigation({ pathname }: { pathname: string }) {
  return (
    <>
      <nav className={styles.nav} aria-label={ACCOUNT_TITLE}>
        <ul className={styles.nav}>
          {ACCOUNT_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav className={styles.mobileNav} aria-label={ACCOUNT_TITLE}>
        {ACCOUNT_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

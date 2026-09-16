import Link from "next/link";
import {
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_LABELS,
  type DashboardPeriod,
} from "@/contracts/admin/dashboard";
import { ADMIN_DASHBOARD_PERIOD_NAV } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { cx } from "@/lib/cx";
import styles from "./AdminDashboard.module.css";

export function AdminDashboardPeriodNav({ period }: { period: DashboardPeriod }) {
  return (
    <nav className={styles.headerAction} aria-label={ADMIN_DASHBOARD_PERIOD_NAV}>
      <ul className={styles.periods}>
        {DASHBOARD_PERIODS.map((value) => {
          const current = value === period;
          const href = value === "7d" ? routes.admin : `${routes.admin}?period=${value}`;
          return (
            <li key={value}>
              <Link
                href={href}
                className={cx(styles.period, current ? styles.periodCurrent : undefined)}
                aria-current={current ? "page" : undefined}
              >
                {DASHBOARD_PERIOD_LABELS[value]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

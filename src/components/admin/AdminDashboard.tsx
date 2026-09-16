import { Suspense } from "react";
import type { AdminV1Role } from "@/contracts/admin/roles";
import type { DashboardPeriod } from "@/contracts/admin/dashboard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ADMIN_HOME_BODY,
  ADMIN_HOME_KICKER,
  ADMIN_HOME_TITLE,
} from "@/lib/admin-copy";
import { AdminDashboardKpis } from "./AdminDashboardKpis";
import { AdminDashboardPeriodNav } from "./AdminDashboardPeriodNav";
import { AdminOperationalAlerts } from "./AdminOperationalAlerts";
import { AdminRecentOrders } from "./AdminRecentOrders";
import { AdminSalesOverview } from "./AdminSalesOverview";
import {
  AdminAlertsSkeleton,
  AdminKpiSkeleton,
  AdminOrdersSkeleton,
  AdminSalesSkeleton,
} from "./AdminDashboardSkeletons";
import styles from "./AdminDashboard.module.css";

export function AdminDashboard({
  period,
  role,
}: {
  period: DashboardPeriod;
  role: AdminV1Role;
}) {
  return (
    <div
      data-admin-home
      data-admin-dashboard
      data-admin-role={role}
      data-dashboard-period={period}
    >
      <AdminPageHeader
        kicker={ADMIN_HOME_KICKER}
        title={ADMIN_HOME_TITLE}
        description={ADMIN_HOME_BODY}
        action={<AdminDashboardPeriodNav period={period} />}
      />
      <div className={styles.stack}>
        <Suspense fallback={<AdminKpiSkeleton />}>
          <AdminDashboardKpis period={period} />
        </Suspense>
        <Suspense fallback={<AdminSalesSkeleton />}>
          <AdminSalesOverview period={period} />
        </Suspense>
        <div className={styles.split}>
          <Suspense fallback={<AdminOrdersSkeleton />}>
            <AdminRecentOrders />
          </Suspense>
          <Suspense fallback={<AdminAlertsSkeleton />}>
            <AdminOperationalAlerts />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

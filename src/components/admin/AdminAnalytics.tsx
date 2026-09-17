import { Suspense } from "react";
import type { DashboardPeriod } from "@/contracts/admin/dashboard";
import { AdminDashboardKpis } from "./AdminDashboardKpis";
import { AdminDashboardPeriodNav } from "./AdminDashboardPeriodNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminRecentOrders } from "./AdminRecentOrders";
import { AdminSalesOverview } from "./AdminSalesOverview";
import { AdminAnalyticsCustomers } from "./AdminAnalyticsCustomers";
import {
  AdminKpiSkeleton,
  AdminOrdersSkeleton,
  AdminSalesSkeleton,
} from "./AdminDashboardSkeletons";
import { AdminAnalyticsCustomersSkeleton } from "./AdminAnalyticsSkeletons";
import {
  ADMIN_ANALYTICS_BODY,
  ADMIN_ANALYTICS_PERIOD_NAV,
  ADMIN_ANALYTICS_TITLE,
  ADMIN_ANALYTICS_UNAVAILABLE_BODY,
  ADMIN_ANALYTICS_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "./AdminDashboard.module.css";

export function AdminAnalytics({ period }: { period: DashboardPeriod }) {
  return (
    <div data-admin-analytics data-analytics-period={period}>
      <AdminPageHeader
        title={ADMIN_ANALYTICS_TITLE}
        description={ADMIN_ANALYTICS_BODY}
        action={
          <AdminDashboardPeriodNav
            period={period}
            basePath={routes.adminAnalytics}
            label={ADMIN_ANALYTICS_PERIOD_NAV}
          />
        }
      />
      <div className={styles.stack}>
        <Suspense fallback={<AdminKpiSkeleton />}>
          <AdminDashboardKpis
            period={period}
            unavailableTitle={ADMIN_ANALYTICS_UNAVAILABLE_TITLE}
            unavailableBody={ADMIN_ANALYTICS_UNAVAILABLE_BODY}
          />
        </Suspense>
        <Suspense fallback={<AdminSalesSkeleton />}>
          <AdminSalesOverview
            period={period}
            unavailableTitle={ADMIN_ANALYTICS_UNAVAILABLE_TITLE}
            unavailableBody={ADMIN_ANALYTICS_UNAVAILABLE_BODY}
          />
        </Suspense>
        <div className={styles.split}>
          <Suspense fallback={<AdminOrdersSkeleton />}>
            <AdminRecentOrders
              unavailableTitle={ADMIN_ANALYTICS_UNAVAILABLE_TITLE}
              unavailableBody={ADMIN_ANALYTICS_UNAVAILABLE_BODY}
            />
          </Suspense>
          <Suspense fallback={<AdminAnalyticsCustomersSkeleton />}>
            <AdminAnalyticsCustomers />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

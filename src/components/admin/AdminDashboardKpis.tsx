import type { DashboardPeriod } from "@/contracts/admin/dashboard";
import {
  ADMIN_KPI_AOV,
  ADMIN_KPI_AOV_EMPTY,
  ADMIN_KPI_HINT,
  ADMIN_KPI_ORDERS,
  ADMIN_KPI_PRODUCTS_SOLD,
  ADMIN_KPI_REVENUE,
} from "@/lib/admin-copy";
import { formatGbpMinor } from "@/lib/money";
import { loadDashboardPeriodSnapshot } from "@/services/admin-dashboard";
import { AdminDashboardUnavailable } from "./AdminDashboardUnavailable";
import styles from "./AdminDashboard.module.css";

export async function AdminDashboardKpis({ period }: { period: DashboardPeriod }) {
  const result = await loadDashboardPeriodSnapshot(period);
  if (result.status !== "ok") {
    return <AdminDashboardUnavailable />;
  }
  const { kpis } = result.data;
  const items = [
    {
      id: "revenue",
      label: ADMIN_KPI_REVENUE,
      value: formatGbpMinor(kpis.revenueMinor),
    },
    {
      id: "orders",
      label: ADMIN_KPI_ORDERS,
      value: String(kpis.orderCount),
    },
    {
      id: "aov",
      label: ADMIN_KPI_AOV,
      value: kpis.aovMinor === null ? ADMIN_KPI_AOV_EMPTY : formatGbpMinor(kpis.aovMinor),
    },
    {
      id: "products-sold",
      label: ADMIN_KPI_PRODUCTS_SOLD,
      value: String(kpis.productsSold),
    },
  ] as const;

  return (
    <section className={styles.section} aria-labelledby="dashboard-kpis-heading">
      <h2 id="dashboard-kpis-heading" className="visually-hidden">
        Key figures
      </h2>
      <ul className={styles.kpis}>
        {items.map((item) => (
          <li key={item.id} className={styles.kpi} data-kpi={item.id}>
            <p className={`text-micro ${styles.kpiLabel}`}>{item.label}</p>
            <p className={`text-h3 ${styles.kpiValue}`}>{item.value}</p>
          </li>
        ))}
      </ul>
      <p className={`text-small ${styles.hint}`}>{ADMIN_KPI_HINT}</p>
    </section>
  );
}

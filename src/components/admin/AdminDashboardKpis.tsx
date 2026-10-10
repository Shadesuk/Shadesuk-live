import type { DashboardPeriod } from "@/contracts/admin/dashboard";
import { adminPaymentStatusLabel } from "@/contracts/admin/dashboard";
import {
  ADMIN_KPI_AOV,
  ADMIN_KPI_AOV_EMPTY,
  ADMIN_KPI_FEES,
  ADMIN_KPI_HINT,
  ADMIN_KPI_NOT_AVAILABLE,
  ADMIN_KPI_ORDERS,
  ADMIN_KPI_PRODUCTS_SOLD,
  ADMIN_KPI_REFUNDED,
  ADMIN_KPI_REVENUE,
  ADMIN_KPI_SETTLEMENT,
  ADMIN_KPI_STATUS_PENDING,
} from "@/lib/admin-copy";
import { formatChargeMinor } from "@/lib/money";
import { loadDashboardPeriodSnapshot } from "@/services/admin-dashboard";
import { AdminDashboardUnavailable } from "./AdminDashboardUnavailable";
import styles from "./AdminDashboard.module.css";

export async function AdminDashboardKpis({
  period,
  unavailableTitle,
  unavailableBody,
}: {
  period: DashboardPeriod;
  unavailableTitle?: string;
  unavailableBody?: string;
}) {
  const result = await loadDashboardPeriodSnapshot(period);
  if (result.status !== "ok") {
    return <AdminDashboardUnavailable title={unavailableTitle} body={unavailableBody} />;
  }
  const { currencies, counts, productsSold, rangeLabel, settlement, fees } = result.data;
  const captured = currencies.filter((total) => total.capturedMinor > 0);
  const refunded = currencies.filter((total) => total.refundedMinor > 0);
  const averages = currencies.filter((total) => total.aovMinor !== null);
  const items = [
    {
      id: "revenue",
      label: ADMIN_KPI_REVENUE,
      value:
        captured.length === 0
          ? ADMIN_KPI_AOV_EMPTY
          : captured.map((total) => formatChargeMinor(total.capturedMinor, total.currency)).join(" · "),
    },
    {
      id: "orders",
      label: ADMIN_KPI_ORDERS,
      value: String(counts.captured),
    },
    {
      id: "aov",
      label: ADMIN_KPI_AOV,
      value:
        averages.length === 0
          ? ADMIN_KPI_AOV_EMPTY
          : averages
              .map((total) => formatChargeMinor(total.aovMinor ?? 0, total.currency))
              .join(" · "),
    },
    {
      id: "products-sold",
      label: ADMIN_KPI_PRODUCTS_SOLD,
      value: String(productsSold),
    },
  ] as const;
  const statuses = [
    { id: "captured", label: adminPaymentStatusLabel("captured"), value: counts.captured },
    { id: "pending", label: ADMIN_KPI_STATUS_PENDING, value: counts.pending },
    { id: "failed", label: adminPaymentStatusLabel("failed"), value: counts.failed },
    { id: "cancelled", label: adminPaymentStatusLabel("cancelled"), value: counts.cancelled },
    { id: "refunded", label: adminPaymentStatusLabel("refunded"), value: counts.refunded },
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
      <ul className={styles.kpis}>
        {statuses.map((status) => (
          <li key={status.id} className={styles.kpi} data-payment-count={status.id}>
            <p className={`text-micro ${styles.kpiLabel}`}>{status.label}</p>
            <p className={`text-h3 ${styles.kpiValue}`}>{status.value}</p>
          </li>
        ))}
      </ul>
      {refunded.length > 0 ? (
        <p className={`text-small ${styles.hint}`}>
          {ADMIN_KPI_REFUNDED}:{" "}
          {refunded.map((total) => formatChargeMinor(total.refundedMinor, total.currency)).join(" · ")}
        </p>
      ) : (
        <p className={`text-small ${styles.hint}`}>
          {ADMIN_KPI_REFUNDED}: {ADMIN_KPI_AOV_EMPTY}
        </p>
      )}
      <p className={`text-small ${styles.hint}`}>
        {ADMIN_KPI_SETTLEMENT}: {settlement === ADMIN_KPI_NOT_AVAILABLE ? ADMIN_KPI_NOT_AVAILABLE : settlement}.{" "}
        {ADMIN_KPI_FEES}: {fees === ADMIN_KPI_NOT_AVAILABLE ? ADMIN_KPI_NOT_AVAILABLE : fees}.
      </p>
      <p className={`text-small ${styles.hint}`}>
        {rangeLabel}. {ADMIN_KPI_HINT}
      </p>
    </section>
  );
}

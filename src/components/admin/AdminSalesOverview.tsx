import type { DashboardCurrencySeries } from "@/services/admin-dashboard";
import type { DashboardPeriod } from "@/contracts/admin/dashboard";
import {
  ADMIN_KPI_ORDERS,
  ADMIN_KPI_REVENUE,
  ADMIN_NO_SALES_BODY,
  ADMIN_NO_SALES_TITLE,
  ADMIN_SALES_CHART_CAPTION,
  ADMIN_SALES_DAILY_FIGURES,
  ADMIN_SALES_OVERVIEW_TITLE,
} from "@/lib/admin-copy";
import { formatChargeMinor } from "@/lib/money";
import { loadDashboardPeriodSnapshot } from "@/services/admin-dashboard";
import { AdminDashboardUnavailable } from "./AdminDashboardUnavailable";
import styles from "./AdminDashboard.module.css";

export async function AdminSalesOverview({
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
  const { series, hasSales } = result.data;

  return (
    <section className={styles.section} aria-labelledby="dashboard-sales-heading">
      <h2 id="dashboard-sales-heading" className={styles.sectionTitle}>
        {ADMIN_SALES_OVERVIEW_TITLE}
      </h2>
      {hasSales ? (
        series.map((item) => <SalesChart key={item.currency} series={item} />)
      ) : (
        <div className={styles.quiet}>
          <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_NO_SALES_TITLE}</p>
          <p className={`text-small ${styles.quietBody}`}>{ADMIN_NO_SALES_BODY}</p>
        </div>
      )}
    </section>
  );
}

function SalesChart({ series }: { series: DashboardCurrencySeries }) {
  const points = series.points;
  const maxRevenue = points.reduce((max, point) => Math.max(max, point.revenueMinor), 0);
  const capturedRevenue = points.reduce((sum, point) => sum + point.revenueMinor, 0);
  const paidOrders = points.reduce((sum, point) => sum + point.qualifyingOrderCount, 0);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure className={styles.figure}>
      <figcaption className="visually-hidden">
        {series.currency}. {ADMIN_SALES_CHART_CAPTION}
      </figcaption>
      <p className={`text-small ${styles.hint}`}>
        {formatChargeMinor(capturedRevenue, series.currency)} captured · {paidOrders} paid{" "}
        {paidOrders === 1 ? "order" : "orders"}
      </p>
      <ul className={styles.chart} aria-hidden="true">
        {points.map((point) => {
          const ratio = maxRevenue === 0 ? 0 : (point.revenueMinor / maxRevenue) * 100;
          const height = point.revenueMinor > 0 ? Math.max(2, Math.round(ratio)) : 0;
          return (
            <li key={point.dateKey} className={styles.barItem}>
              <span
                className={styles.bar}
                style={{ height: `${height}%` }}
                title={`${point.label}: ${formatChargeMinor(point.revenueMinor, series.currency)}, ${point.orderCount} orders`}
              />
            </li>
          );
        })}
      </ul>
      {first && last ? (
        <div className={styles.barLabels} aria-hidden="true">
          <p className={`text-micro ${styles.barLabel}`}>{first.label}</p>
          {points.length > 2 ? (
            <p className={`text-micro ${styles.barLabel}`}>{points[Math.floor(points.length / 2)]?.label}</p>
          ) : null}
          <p className={`text-micro ${styles.barLabel}`}>{last.label}</p>
        </div>
      ) : null}
      <details className={styles.daily}>
        <summary>{ADMIN_SALES_DAILY_FIGURES}</summary>
        <div className={styles.tableWrap}>
          <table className={styles.dailyTable}>
            <caption className="visually-hidden">
              {series.currency}. {ADMIN_SALES_CHART_CAPTION}
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">{ADMIN_KPI_REVENUE}</th>
                <th scope="col">{ADMIN_KPI_ORDERS}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.dateKey}>
                  <th scope="row">{point.label}</th>
                  <td>{formatChargeMinor(point.revenueMinor, series.currency)}</td>
                  <td>{point.orderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

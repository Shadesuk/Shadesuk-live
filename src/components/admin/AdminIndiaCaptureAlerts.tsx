import Link from "next/link";
import { formatOrderHeading } from "@/contracts/order/dto";
import {
  ADMIN_INDIA_CAPTURE_ALERTS_BODY,
  ADMIN_INDIA_CAPTURE_ALERTS_TITLE,
  ADMIN_INDIA_CAPTURE_ALERTS_UNAVAILABLE,
  ADMIN_INDIA_CAPTURE_AMOUNT,
  ADMIN_INDIA_CAPTURE_PAYMENT,
  ADMIN_INDIA_CAPTURE_VIEW,
} from "@/lib/admin-copy";
import { formatInrMinor } from "@/lib/money";
import { loadIndiaCaptureAlerts } from "@/services/admin-india-capture-alerts";
import styles from "./AdminDashboard.module.css";

export async function AdminIndiaCaptureAlerts() {
  const result = await loadIndiaCaptureAlerts();
  if (result.status !== "ok") {
    return (
      <section className={styles.section} aria-labelledby="india-capture-alerts-heading" data-india-capture-alerts="error">
        <h2 id="india-capture-alerts-heading" className={styles.sectionTitle}>
          {ADMIN_INDIA_CAPTURE_ALERTS_TITLE}
        </h2>
        <p className={`text-small ${styles.quietBody}`}>{ADMIN_INDIA_CAPTURE_ALERTS_UNAVAILABLE}</p>
      </section>
    );
  }
  if (result.alerts.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="india-capture-alerts-heading" data-india-capture-alerts="open">
      <div className={styles.sectionHead}>
        <h2 id="india-capture-alerts-heading" className={styles.sectionTitle}>
          {ADMIN_INDIA_CAPTURE_ALERTS_TITLE}
        </h2>
        <p className={`text-small ${styles.alertCount}`}>{result.alerts.length}</p>
      </div>
      <p className={`text-small ${styles.hint}`}>{ADMIN_INDIA_CAPTURE_ALERTS_BODY}</p>
      <ul className={styles.orders}>
        {result.alerts.map((alert) => (
          <li key={alert.id}>
            <Link href={alert.href} className={styles.orderLink} data-india-capture-alert={alert.id}>
              <p className={`text-small ${styles.orderRef}`}>{formatOrderHeading(alert.orderReference)}</p>
              <p className={styles.orderMeta}>
                <span className="text-small">
                  {ADMIN_INDIA_CAPTURE_PAYMENT} {alert.providerPaymentId}
                </span>
                <span className="text-small">
                  {ADMIN_INDIA_CAPTURE_AMOUNT} {formatInrMinor(alert.amountMinor)}
                </span>
              </p>
              <span className="text-small">{ADMIN_INDIA_CAPTURE_VIEW}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

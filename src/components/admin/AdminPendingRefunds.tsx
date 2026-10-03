import Link from "next/link";
import type { RefundUrgency } from "@/contracts/order/cancellation";
import {
  ADMIN_REFUND_ALERTS_BODY,
  ADMIN_REFUND_ALERTS_TITLE,
  ADMIN_REFUND_ALERTS_UNAVAILABLE,
  ADMIN_REFUND_AMOUNT,
  ADMIN_REFUND_DUE,
  ADMIN_REFUND_URGENCY_APPROACHING,
  ADMIN_REFUND_URGENCY_OVERDUE,
  ADMIN_REFUND_URGENCY_PENDING,
  ADMIN_REFUND_VIEW_ORDER,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatGbpMinor } from "@/lib/money";
import { formatOrderHeading } from "@/contracts/order/dto";
import { loadPendingRefundAlerts } from "@/services/admin-refunds";
import styles from "./AdminDashboard.module.css";

const URGENCY_LABEL: Record<RefundUrgency, string> = {
  pending: ADMIN_REFUND_URGENCY_PENDING,
  approaching: ADMIN_REFUND_URGENCY_APPROACHING,
  overdue: ADMIN_REFUND_URGENCY_OVERDUE,
};

export async function AdminPendingRefunds() {
  const result = await loadPendingRefundAlerts();
  if (result.status !== "ok") {
    return (
      <section className={styles.section} aria-labelledby="pending-refunds-heading" data-pending-refunds="error">
        <h2 id="pending-refunds-heading" className={styles.sectionTitle}>
          {ADMIN_REFUND_ALERTS_TITLE}
        </h2>
        <p className={`text-small ${styles.quietBody}`}>{ADMIN_REFUND_ALERTS_UNAVAILABLE}</p>
      </section>
    );
  }
  if (result.alerts.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="pending-refunds-heading" data-pending-refunds="open">
      <div className={styles.sectionHead}>
        <h2 id="pending-refunds-heading" className={styles.sectionTitle}>
          {ADMIN_REFUND_ALERTS_TITLE}
        </h2>
        <p className={`text-small ${styles.alertCount}`}>{result.alerts.length}</p>
      </div>
      <p className={`text-small ${styles.hint}`}>{ADMIN_REFUND_ALERTS_BODY}</p>
      <ul className={styles.orders}>
        {result.alerts.map((alert) => (
          <li key={alert.id}>
            <Link
              href={alert.href}
              className={styles.orderLink}
              data-refund-alert={alert.id}
              data-refund-urgency={alert.urgency}
            >
              <p className={`text-small ${styles.orderRef}`}>{formatOrderHeading(alert.orderReference)}</p>
              <p className={styles.orderMeta}>
                <span className="text-small">
                  {ADMIN_REFUND_AMOUNT} {formatGbpMinor(alert.amountMinor)}
                </span>
                <span className="text-small">
                  {ADMIN_REFUND_DUE} {formatAdminDateTime(alert.dueAt)}
                </span>
                <span className="text-small">{URGENCY_LABEL[alert.urgency]}</span>
              </p>
              <span className="text-small">{ADMIN_REFUND_VIEW_ORDER}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

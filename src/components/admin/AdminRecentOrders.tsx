import Link from "next/link";
import {
  adminOrderStatusLabel,
  adminPaymentStatusLabel,
} from "@/contracts/admin/dashboard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_NO_ORDERS_BODY,
  ADMIN_NO_ORDERS_TITLE,
  ADMIN_ORDER_COL_AMOUNT,
  ADMIN_ORDER_COL_CUSTOMER,
  ADMIN_ORDER_COL_DATE,
  ADMIN_ORDER_COL_PAYMENT,
  ADMIN_ORDER_COL_REFERENCE,
  ADMIN_ORDER_COL_STATUS,
  ADMIN_RECENT_ORDERS_TITLE,
  ADMIN_RECENT_ORDERS_VIEW,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatGbpMinor } from "@/lib/money";
import { adminOrderPath, routes } from "@/lib/navigation";
import { loadDashboardRecentOrders } from "@/services/admin-dashboard";
import { AdminDashboardUnavailable } from "./AdminDashboardUnavailable";
import styles from "./AdminDashboard.module.css";

export async function AdminRecentOrders({
  unavailableTitle,
  unavailableBody,
}: {
  unavailableTitle?: string;
  unavailableBody?: string;
} = {}) {
  const result = await loadDashboardRecentOrders();
  if (result.status !== "ok") {
    return <AdminDashboardUnavailable title={unavailableTitle} body={unavailableBody} />;
  }
  const orders = result.data;

  return (
    <section className={styles.section} aria-labelledby="dashboard-orders-heading">
      <div className={styles.sectionHead}>
        <h2 id="dashboard-orders-heading" className={styles.sectionTitle}>
          {ADMIN_RECENT_ORDERS_TITLE}
        </h2>
        <ButtonLink href={routes.adminOrders} variant="tertiary">
          {ADMIN_RECENT_ORDERS_VIEW}
        </ButtonLink>
      </div>
      {orders.length === 0 ? (
        <div className={styles.quiet}>
          <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_NO_ORDERS_TITLE}</p>
          <p className={`text-small ${styles.quietBody}`}>{ADMIN_NO_ORDERS_BODY}</p>
        </div>
      ) : (
        <div>
          <div className={styles.head} aria-hidden="true">
            <span>{ADMIN_ORDER_COL_REFERENCE}</span>
            <span>{ADMIN_ORDER_COL_CUSTOMER}</span>
            <span>{ADMIN_ORDER_COL_DATE}</span>
            <span>{ADMIN_ORDER_COL_AMOUNT}</span>
            <span>{ADMIN_ORDER_COL_PAYMENT}</span>
            <span>{ADMIN_ORDER_COL_STATUS}</span>
          </div>
          <ul className={styles.orders}>
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={adminOrderPath(order.id)} className={styles.orderLink}>
                  <p className={`text-small ${styles.orderRef}`}>
                    <span className="visually-hidden">{ADMIN_ORDER_COL_REFERENCE} </span>
                    {order.orderReference}
                  </p>
                  <span className="text-small">
                    <span className="visually-hidden">{ADMIN_ORDER_COL_CUSTOMER} </span>
                    {order.customer}
                  </span>
                  <time className="text-small" dateTime={order.createdAt}>
                    <span className="visually-hidden">{ADMIN_ORDER_COL_DATE} </span>
                    {formatAdminDateTime(order.createdAt)}
                  </time>
                  <span className={`text-small ${styles.orderAmount}`}>
                    <span className="visually-hidden">{ADMIN_ORDER_COL_AMOUNT} </span>
                    {formatGbpMinor(order.totalMinor)}
                  </span>
                  <span className={styles.orderStatus}>
                    <span className="text-small">
                      <span className="visually-hidden">{ADMIN_ORDER_COL_PAYMENT} </span>
                      {adminPaymentStatusLabel(order.paymentStatus)}
                    </span>
                    <span className="text-small">
                      <span className="visually-hidden">{ADMIN_ORDER_COL_STATUS} </span>
                      {adminOrderStatusLabel(order.orderStatus)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

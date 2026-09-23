import { Suspense } from "react";
import Link from "next/link";
import { adminOrderStatusLabel, adminPaymentStatusLabel } from "@/contracts/admin/dashboard";
import { adminShipmentStatusLabel } from "@/contracts/admin/orders";
import {
  adminFulfilmentHref,
  FULFILMENT_VIEW_LABELS,
  FULFILMENT_VIEWS,
  type FulfilmentView,
  type OpsFulfilmentRow,
} from "@/contracts/admin/ops";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ADMIN_FULFILMENT_BODY,
  ADMIN_FULFILMENT_COL_CUSTOMER,
  ADMIN_FULFILMENT_COL_ORDER,
  ADMIN_FULFILMENT_COL_ORDER_STATUS,
  ADMIN_FULFILMENT_COL_SHIPMENT,
  ADMIN_FULFILMENT_COL_TRACKING,
  ADMIN_FULFILMENT_EMPTY_BODY,
  ADMIN_FULFILMENT_EMPTY_TITLE,
  ADMIN_FULFILMENT_LOADING,
  ADMIN_FULFILMENT_NAV,
  ADMIN_FULFILMENT_NO_SHIPMENT,
  ADMIN_FULFILMENT_NO_TRACKING,
  ADMIN_FULFILMENT_TITLE,
  ADMIN_FULFILMENT_UNAVAILABLE_BODY,
  ADMIN_FULFILMENT_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { adminOrderPath } from "@/lib/navigation";
import { loadFulfilmentQueue } from "@/services/admin-ops";
import { AdminDashboardUnavailable } from "./AdminDashboardUnavailable";
import { AdminOpsEmpty, AdminOpsPagination, AdminOpsSkeleton, AdminOpsViewNav } from "./AdminOpsChrome";
import styles from "./AdminOps.module.css";

export function AdminFulfilmentPage({ view, page }: { view: FulfilmentView; page: number }) {
  return (
    <div data-admin-fulfilment data-fulfilment-view={view}>
      <AdminPageHeader
        title={ADMIN_FULFILMENT_TITLE}
        description={ADMIN_FULFILMENT_BODY}
        action={
          <AdminOpsViewNav
            label={ADMIN_FULFILMENT_NAV}
            views={FULFILMENT_VIEWS}
            labels={FULFILMENT_VIEW_LABELS}
            current={view}
            hrefFor={(next) => adminFulfilmentHref(next)}
          />
        }
      />
      <div className={styles.stack}>
        <Suspense fallback={<AdminOpsSkeleton label={ADMIN_FULFILMENT_LOADING} />}>
          <FulfilmentQueue view={view} page={page} />
        </Suspense>
      </div>
    </div>
  );
}

async function FulfilmentQueue({ view, page }: { view: FulfilmentView; page: number }) {
  const result = await loadFulfilmentQueue(view, page);
  if (result.status !== "ok") {
    return (
      <AdminDashboardUnavailable
        title={ADMIN_FULFILMENT_UNAVAILABLE_TITLE}
        body={ADMIN_FULFILMENT_UNAVAILABLE_BODY}
      />
    );
  }
  const { rows, total, page: currentPage, pageCount } = result.data;
  if (rows.length === 0) {
    return <AdminOpsEmpty title={ADMIN_FULFILMENT_EMPTY_TITLE} body={ADMIN_FULFILMENT_EMPTY_BODY} />;
  }
  return (
    <div>
      <div className={`${styles.head} ${styles.fulfilmentHead}`} aria-hidden="true">
        <span>{ADMIN_FULFILMENT_COL_ORDER}</span>
        <span>{ADMIN_FULFILMENT_COL_CUSTOMER}</span>
        <span>{ADMIN_FULFILMENT_COL_ORDER_STATUS}</span>
        <span>{ADMIN_FULFILMENT_COL_SHIPMENT}</span>
        <span>{ADMIN_FULFILMENT_COL_TRACKING}</span>
      </div>
      <ul className={styles.list} aria-label={ADMIN_FULFILMENT_TITLE}>
        {rows.map((row) => (
          <li key={row.orderId}>
            <FulfilmentRow row={row} />
          </li>
        ))}
      </ul>
      <AdminOpsPagination
        page={currentPage}
        pageCount={pageCount}
        total={total}
        hrefFor={(next) => adminFulfilmentHref(view, next)}
      />
    </div>
  );
}

function FulfilmentRow({ row }: { row: OpsFulfilmentRow }) {
  const tracking = row.trackingNumber ?? ADMIN_FULFILMENT_NO_TRACKING;
  const shipment = row.shipmentStatus
    ? adminShipmentStatusLabel(row.shipmentStatus)
    : ADMIN_FULFILMENT_NO_SHIPMENT;
  return (
    <Link href={adminOrderPath(row.orderId)} className={`${styles.row} ${styles.fulfilmentRow}`}>
      <p className={`text-small ${styles.primary}`}>
        <span className="visually-hidden">{ADMIN_FULFILMENT_COL_ORDER} </span>
        {row.orderReference}
      </p>
      <span className="text-small">
        <span className="visually-hidden">{ADMIN_FULFILMENT_COL_CUSTOMER} </span>
        {row.customerName}
      </span>
      <span className={styles.meta}>
        <span className="text-small">
          <span className="visually-hidden">{ADMIN_FULFILMENT_COL_ORDER_STATUS} </span>
          {adminOrderStatusLabel(row.orderStatus)}
          {" · "}
          {adminPaymentStatusLabel(row.paymentStatus)}
        </span>
        <span className="text-small">
          <span className="visually-hidden">{ADMIN_FULFILMENT_COL_SHIPMENT} </span>
          {shipment}
        </span>
        <span className="text-small">
          <span className="visually-hidden">{ADMIN_FULFILMENT_COL_TRACKING} </span>
          {row.carrierName ? `${row.carrierName} · ${tracking}` : tracking}
        </span>
      </span>
      <time className="visually-hidden" dateTime={row.createdAt}>
        {formatAdminDateTime(row.createdAt)}
      </time>
    </Link>
  );
}

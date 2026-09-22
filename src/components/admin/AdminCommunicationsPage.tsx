import { Suspense } from "react";
import Link from "next/link";
import {
  adminCommunicationsHref,
  COMMUNICATION_VIEW_LABELS,
  COMMUNICATION_VIEWS,
  OPS_EMAIL_ORDER_CONFIRMATION,
  OPS_EMAIL_SHIPMENT_CONFIRMATION,
  type CommunicationView,
  type OpsEmailCounts,
  type OpsEmailRow,
} from "@/contracts/admin/ops";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ADMIN_COMMS_BODY,
  ADMIN_COMMS_COL_ORDER,
  ADMIN_COMMS_COL_RECIPIENT,
  ADMIN_COMMS_COL_STATUS,
  ADMIN_COMMS_COL_TYPE,
  ADMIN_COMMS_COL_WHEN,
  ADMIN_COMMS_EMPTY_CONFIRMATIONS_BODY,
  ADMIN_COMMS_EMPTY_CONFIRMATIONS_TITLE,
  ADMIN_COMMS_EMPTY_FAILED_BODY,
  ADMIN_COMMS_EMPTY_FAILED_TITLE,
  ADMIN_COMMS_FAILED,
  ADMIN_COMMS_FAILED_STATUS,
  ADMIN_COMMS_LOADING,
  ADMIN_COMMS_NAV,
  ADMIN_COMMS_NO_ORDER,
  ADMIN_CUSTOMER_VIEW_ORDER,
  ADMIN_COMMS_ORDER,
  ADMIN_COMMS_ORDER_TYPE,
  ADMIN_COMMS_PENDING,
  ADMIN_COMMS_SENT,
  ADMIN_COMMS_SHIPMENT,
  ADMIN_COMMS_SHIPMENT_TYPE,
  ADMIN_COMMS_TITLE,
  ADMIN_COMMS_UNAVAILABLE_BODY,
  ADMIN_COMMS_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { adminOrderPath } from "@/lib/navigation";
import { loadCommunications } from "@/services/admin-ops";
import { AdminDashboardUnavailable } from "./AdminDashboardUnavailable";
import { AdminOpsEmpty, AdminOpsPagination, AdminOpsSkeleton, AdminOpsViewNav } from "./AdminOpsChrome";
import styles from "./AdminOps.module.css";

export function AdminCommunicationsPage({ view, page }: { view: CommunicationView; page: number }) {
  return (
    <div data-admin-communications data-communications-view={view}>
      <AdminPageHeader
        title={ADMIN_COMMS_TITLE}
        description={ADMIN_COMMS_BODY}
        action={
          <AdminOpsViewNav
            label={ADMIN_COMMS_NAV}
            views={COMMUNICATION_VIEWS}
            labels={COMMUNICATION_VIEW_LABELS}
            current={view}
            hrefFor={(next) => adminCommunicationsHref(next)}
          />
        }
      />
      <div className={styles.stack}>
        <Suspense fallback={<AdminOpsSkeleton label={ADMIN_COMMS_LOADING} />}>
          <CommunicationsQueue view={view} page={page} />
        </Suspense>
      </div>
    </div>
  );
}

async function CommunicationsQueue({ view, page }: { view: CommunicationView; page: number }) {
  const result = await loadCommunications(view, page);
  if (result.status !== "ok") {
    return (
      <AdminDashboardUnavailable
        title={ADMIN_COMMS_UNAVAILABLE_TITLE}
        body={ADMIN_COMMS_UNAVAILABLE_BODY}
      />
    );
  }
  const { counts, page: list } = result.data;
  return (
    <div className={styles.stack}>
      <EmailCounts counts={counts} />
      {list.rows.length === 0 ? (
        <AdminOpsEmpty
          title={view === "failed" ? ADMIN_COMMS_EMPTY_FAILED_TITLE : ADMIN_COMMS_EMPTY_CONFIRMATIONS_TITLE}
          body={view === "failed" ? ADMIN_COMMS_EMPTY_FAILED_BODY : ADMIN_COMMS_EMPTY_CONFIRMATIONS_BODY}
        />
      ) : (
        <div>
          <div className={`${styles.head} ${styles.emailHead}`} aria-hidden="true">
            <span>{ADMIN_COMMS_COL_TYPE}</span>
            <span>{ADMIN_COMMS_COL_STATUS}</span>
            <span>{ADMIN_COMMS_COL_RECIPIENT}</span>
            <span>{ADMIN_COMMS_COL_ORDER}</span>
            <span>{ADMIN_COMMS_COL_WHEN}</span>
          </div>
          <ul className={styles.list} aria-label={ADMIN_COMMS_TITLE}>
            {list.rows.map((row) => (
              <li key={row.id}>
                <EmailRow row={row} />
              </li>
            ))}
          </ul>
          <AdminOpsPagination
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
            hrefFor={(next) => adminCommunicationsHref(view, next)}
          />
        </div>
      )}
    </div>
  );
}

function EmailCounts({ counts }: { counts: OpsEmailCounts }) {
  return (
    <ul className={styles.counts} data-email-counts>
      <li className={styles.count}>
        <p className={`text-micro ${styles.countLabel}`}>{ADMIN_COMMS_FAILED}</p>
        <p className={`text-h3 ${styles.countValue}`}>{counts.failed}</p>
      </li>
      <li className={styles.count}>
        <p className={`text-micro ${styles.countLabel}`}>{ADMIN_COMMS_ORDER}</p>
        <p className={`text-h3 ${styles.countValue}`}>{counts.orderConfirmations}</p>
        <p className={`text-small ${styles.breakdown}`}>
          {counts.orderConfirmationsSent} {ADMIN_COMMS_SENT.toLowerCase()} · {counts.orderConfirmationsPending}{" "}
          {ADMIN_COMMS_PENDING.toLowerCase()} · {counts.orderConfirmationsFailed} {ADMIN_COMMS_FAILED_STATUS.toLowerCase()}
        </p>
      </li>
      <li className={styles.count}>
        <p className={`text-micro ${styles.countLabel}`}>{ADMIN_COMMS_SHIPMENT}</p>
        <p className={`text-h3 ${styles.countValue}`}>{counts.shipmentConfirmations}</p>
        <p className={`text-small ${styles.breakdown}`}>
          {counts.shipmentConfirmationsSent} {ADMIN_COMMS_SENT.toLowerCase()} · {counts.shipmentConfirmationsPending}{" "}
          {ADMIN_COMMS_PENDING.toLowerCase()} · {counts.shipmentConfirmationsFailed}{" "}
          {ADMIN_COMMS_FAILED_STATUS.toLowerCase()}
        </p>
      </li>
    </ul>
  );
}

function EmailRow({ row }: { row: OpsEmailRow }) {
  const type =
    row.emailType === OPS_EMAIL_ORDER_CONFIRMATION
      ? ADMIN_COMMS_ORDER_TYPE
      : row.emailType === OPS_EMAIL_SHIPMENT_CONFIRMATION
        ? ADMIN_COMMS_SHIPMENT_TYPE
        : row.emailType;
  const status =
    row.status === "sent"
      ? ADMIN_COMMS_SENT
      : row.status === "pending"
        ? ADMIN_COMMS_PENDING
        : ADMIN_COMMS_FAILED_STATUS;
  const order = row.orderId ? (
    <Link href={adminOrderPath(row.orderId)}>{row.orderReference ?? ADMIN_CUSTOMER_VIEW_ORDER}</Link>
  ) : (
    ADMIN_COMMS_NO_ORDER
  );
  return (
    <article className={`${styles.row} ${styles.emailRow} ${styles.staticRow}`}>
      <p className={`text-small ${styles.primary}`}>
        <span className="visually-hidden">{ADMIN_COMMS_COL_TYPE} </span>
        {type}
      </p>
      <span className={styles.meta}>
        <span className="text-small">
          <span className="visually-hidden">{ADMIN_COMMS_COL_STATUS} </span>
          {status}
        </span>
        <span className="text-small">
          <span className="visually-hidden">{ADMIN_COMMS_COL_RECIPIENT} </span>
          {row.recipientEmail}
        </span>
        <span className="text-small">
          <span className="visually-hidden">{ADMIN_COMMS_COL_ORDER} </span>
          {order}
        </span>
        <time className="text-small" dateTime={row.createdAt}>
          <span className="visually-hidden">{ADMIN_COMMS_COL_WHEN} </span>
          {formatAdminDateTime(row.createdAt)}
        </time>
      </span>
      {row.errorMessage ? <p className={`text-small ${styles.error}`}>{row.errorMessage}</p> : null}
    </article>
  );
}

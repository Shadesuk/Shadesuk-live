import Link from "next/link";
import { adminPaymentStatusLabel, isPaymentStatus } from "@/contracts/admin/dashboard";
import {
  LEDGER_CURRENCIES,
  LEDGER_PROVIDERS,
  LEDGER_STATUS_FILTERS,
  type LedgerListQuery,
} from "@/contracts/admin/ledger";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field, FieldSelect } from "@/components/ui/Field";
import {
  ADMIN_KPI_FEES,
  ADMIN_KPI_NOT_AVAILABLE,
  ADMIN_KPI_SETTLEMENT,
  ADMIN_LEDGER_BODY,
  ADMIN_LEDGER_EMPTY_BODY,
  ADMIN_LEDGER_EMPTY_TITLE,
  ADMIN_LEDGER_FILTER_CURRENCY,
  ADMIN_LEDGER_FILTER_FROM,
  ADMIN_LEDGER_FILTER_ORDER,
  ADMIN_LEDGER_FILTER_PROVIDER,
  ADMIN_LEDGER_FILTER_STATUS,
  ADMIN_LEDGER_FILTER_TO,
  ADMIN_LEDGER_LIMITED,
  ADMIN_LEDGER_LIVE,
  ADMIN_LEDGER_TEST,
  ADMIN_LEDGER_TITLE,
  ADMIN_LEDGER_UNAVAILABLE_BODY,
  ADMIN_LEDGER_UNAVAILABLE_TITLE,
  ADMIN_ORDERS_APPLY,
  ADMIN_ORDERS_CLEAR,
  ADMIN_ORDERS_FILTER_ALL,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatChargeMinor } from "@/lib/money";
import { adminOrderPath, routes } from "@/lib/navigation";
import { loadAdminLedger } from "@/services/admin-payment-ledger";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminRetryButton } from "./AdminRetryButton";
import filterStyles from "./AdminOrders.module.css";
import styles from "./AdminDashboard.module.css";

const STATUS_LABELS: Record<(typeof LEDGER_STATUS_FILTERS)[number], string> = {
  charge: "Charge",
  refund: "Refund",
  fee: "Fee",
  settlement: "Settlement",
  adjustment: "Adjustment",
  pending: "Pending",
  captured: "Captured",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function AdminLedgerPage({ query }: { query: LedgerListQuery }) {
  return (
    <div data-admin-ledger>
      <AdminPageHeader title={ADMIN_LEDGER_TITLE} description={ADMIN_LEDGER_BODY} />
      <p className={`text-small ${styles.hint}`}>
        {query.from} – {query.to}. {ADMIN_KPI_SETTLEMENT}: {ADMIN_KPI_NOT_AVAILABLE}. {ADMIN_KPI_FEES}:{" "}
        {ADMIN_KPI_NOT_AVAILABLE}.
      </p>
      <div className={filterStyles.stack}>
        <LedgerFilters query={query} />
        <LedgerTable query={query} />
      </div>
    </div>
  );
}

function LedgerFilters({ query }: { query: LedgerListQuery }) {
  return (
    <form className={filterStyles.filters} method="get" action={routes.adminLedger}>
      <div className={filterStyles.filterFields}>
        <Field
          id="ledger-from"
          name="from"
          type="date"
          label={ADMIN_LEDGER_FILTER_FROM}
          defaultValue={query.from}
        />
        <Field id="ledger-to" name="to" type="date" label={ADMIN_LEDGER_FILTER_TO} defaultValue={query.to} />
        <FieldSelect id="ledger-provider" name="provider" label={ADMIN_LEDGER_FILTER_PROVIDER} defaultValue={query.provider ?? ""}>
          <option value="">{ADMIN_ORDERS_FILTER_ALL}</option>
          {LEDGER_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {provider === "paypal" ? "PayPal" : "Razorpay"}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect id="ledger-currency" name="currency" label={ADMIN_LEDGER_FILTER_CURRENCY} defaultValue={query.currency ?? ""}>
          <option value="">{ADMIN_ORDERS_FILTER_ALL}</option>
          {LEDGER_CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect id="ledger-status" name="status" label={ADMIN_LEDGER_FILTER_STATUS} defaultValue={query.status ?? ""}>
          <option value="">{ADMIN_ORDERS_FILTER_ALL}</option>
          {LEDGER_STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </FieldSelect>
        <Field
          id="ledger-order"
          name="q"
          label={ADMIN_LEDGER_FILTER_ORDER}
          defaultValue={query.orderRef}
          autoComplete="off"
        />
      </div>
      <div className={filterStyles.filterActions}>
        <Button type="submit" variant="primary">
          {ADMIN_ORDERS_APPLY}
        </Button>
        <ButtonLink href={routes.adminLedger} variant="tertiary">
          {ADMIN_ORDERS_CLEAR}
        </ButtonLink>
      </div>
    </form>
  );
}

async function LedgerTable({ query }: { query: LedgerListQuery }) {
  const result = await loadAdminLedger(query);
  if (result.status !== "ok") {
    return (
      <div className={styles.unavailable} role="alert">
        <h2 className={styles.sectionTitle}>{ADMIN_LEDGER_UNAVAILABLE_TITLE}</h2>
        <p className={`text-body ${styles.quietBody}`}>{ADMIN_LEDGER_UNAVAILABLE_BODY}</p>
        <AdminRetryButton />
      </div>
    );
  }
  if (result.rows.length === 0) {
    return (
      <div className={filterStyles.quiet}>
        <p className={`text-micro ${filterStyles.quietTitle}`}>{ADMIN_LEDGER_EMPTY_TITLE}</p>
        <p className={`text-small ${filterStyles.quietBody}`}>{ADMIN_LEDGER_EMPTY_BODY}</p>
      </div>
    );
  }
  return (
    <div className={styles.tableWrap}>
      {result.limited ? <p className={`text-small ${styles.hint}`}>{ADMIN_LEDGER_LIMITED}</p> : null}
      <table className={styles.dailyTable}>
        <caption className="visually-hidden">{ADMIN_LEDGER_TITLE}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Order</th>
            <th scope="col">Provider</th>
            <th scope="col">Entry</th>
            <th scope="col" className={styles.money}>Amount</th>
            <th scope="col">Payment</th>
            <th scope="col">Reference</th>
            <th scope="col">{ADMIN_LEDGER_TEST}</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{formatAdminDateTime(row.occurredAt)}</th>
              <td>
                <Link href={adminOrderPath(row.orderId)}>{row.orderReference}</Link>
              </td>
              <td>{row.provider === "paypal" ? "PayPal" : row.provider === "razorpay" ? "Razorpay" : row.provider}</td>
              <td>{STATUS_LABELS[row.entryType]}</td>
              <td className={styles.money}>{formatChargeMinor(row.amountMinor, row.currency)}</td>
              <td>{isPaymentStatus(row.paymentStatus) ? adminPaymentStatusLabel(row.paymentStatus) : row.paymentStatus}</td>
              <td>{row.providerRef}</td>
              <td>{row.isTest ? ADMIN_LEDGER_TEST : ADMIN_LEDGER_LIVE}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

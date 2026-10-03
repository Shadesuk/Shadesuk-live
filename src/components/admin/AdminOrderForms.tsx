"use client";

import { useActionState } from "react";
import { ADMIN_ORDER_STATUS_LABELS, isShipmentStatus } from "@/contracts/admin/dashboard";
import { canDispatchOrder } from "@/contracts/fulfilment/dispatch";
import {
  ADMIN_SHIPMENT_STATUS_LABELS,
  type AdminShipmentView,
} from "@/contracts/admin/orders";
import { SHIPMENT_STATUSES } from "@/contracts/fulfilment/shipment";
import type { OrderStatus, PaymentStatus } from "@/contracts/order/schema";
import {
  saveAdminFulfilmentAction,
  updateAdminOrderStatusAction,
  type AdminOrderActionState,
} from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/Button";
import { Field, FieldSelect } from "@/components/ui/Field";
import {
  ADMIN_ORDER_CARRIER,
  ADMIN_ORDER_DISPATCH,
  ADMIN_ORDER_DISPATCH_HINT,
  ADMIN_ORDER_SAVE_FULFILMENT,
  ADMIN_ORDER_SAVE_STATUS,
  ADMIN_ORDER_SAVING,
  ADMIN_ORDER_SHIPMENT_STATUS,
  ADMIN_ORDER_STATUS_HEADING,
  ADMIN_ORDER_TRACKING_NUMBER,
  ADMIN_ORDER_TRACKING_URL,
  ADMIN_ORDER_TRACKING_URL_HINT,
  ADMIN_ORDER_SAVE_FAILED_TITLE,
  ADMIN_ORDER_UPDATE_SAVED,
  ADMIN_ORDERS_RETRY,
} from "@/lib/admin-copy";
import styles from "./AdminOrders.module.css";

const idle: AdminOrderActionState = { status: "idle" };

export function AdminOrderStatusForm({
  orderId,
  current,
  targets,
}: {
  orderId: string;
  current: OrderStatus;
  targets: OrderStatus[];
}) {
  const [state, action, pending] = useActionState(updateAdminOrderStatusAction, idle);
  return (
    <form className={styles.form} action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      <FieldSelect
        id="admin-order-status"
        name="status"
        label={ADMIN_ORDER_STATUS_HEADING}
        defaultValue={current}
        error={state.errors?.status}
      >
        {targets.map((status) => (
          <option key={status} value={status}>
            {ADMIN_ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </FieldSelect>
      <FormStatus state={state} pending={pending} />
      <Button type="submit" variant="secondary" loading={pending}>
        {pending
          ? ADMIN_ORDER_SAVING
          : state.status === "error" || state.status === "forbidden"
            ? ADMIN_ORDERS_RETRY
            : state.status === "ok"
              ? ADMIN_ORDER_UPDATE_SAVED
              : ADMIN_ORDER_SAVE_STATUS}
      </Button>
    </form>
  );
}

export function AdminFulfilmentForm({
  orderId,
  shipment,
  paymentStatus,
  orderStatus,
  cancelledAt = null,
  refundStatus = null,
}: {
  orderId: string;
  shipment: AdminShipmentView | null;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  cancelledAt?: string | null;
  refundStatus?: string | null;
}) {
  const [state, action, pending] = useActionState(saveAdminFulfilmentAction, idle);
  const values = state.values;
  const status = isShipmentStatus(values?.status)
    ? values.status
    : shipment?.status ?? "pending";
  const dispatchable = canDispatchOrder({
    paymentStatus,
    orderStatus,
    shipmentStatus: shipment?.status ?? null,
    cancelledAt,
    refundStatus,
  });
  return (
    <form className={styles.form} action={action} noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <Field
        id="admin-carrier"
        name="carrierName"
        label={ADMIN_ORDER_CARRIER}
        defaultValue={values?.carrierName ?? shipment?.carrierName ?? ""}
        autoComplete="off"
        error={state.errors?.carrierName}
      />
      <Field
        id="admin-tracking-number"
        name="trackingNumber"
        label={ADMIN_ORDER_TRACKING_NUMBER}
        defaultValue={values?.trackingNumber ?? shipment?.trackingNumber ?? ""}
        autoComplete="off"
        error={state.errors?.trackingNumber}
      />
      <Field
        id="admin-tracking-url"
        name="trackingUrl"
        type="url"
        inputMode="url"
        label={ADMIN_ORDER_TRACKING_URL}
        hint={ADMIN_ORDER_TRACKING_URL_HINT}
        defaultValue={values?.trackingUrl ?? shipment?.trackingUrl ?? ""}
        autoComplete="off"
        error={state.errors?.trackingUrl}
      />
      <FieldSelect
        id="admin-shipment-status"
        name="status"
        label={ADMIN_ORDER_SHIPMENT_STATUS}
        defaultValue={status}
        error={state.errors?.status}
      >
        {SHIPMENT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {ADMIN_SHIPMENT_STATUS_LABELS[value]}
          </option>
        ))}
      </FieldSelect>
      <FormStatus state={state} pending={pending} />
      {state.status === "invalid" && state.errors?.payment ? (
        <p className={`text-small ${styles.banner}`} role="alert">
          {state.errors.payment}
        </p>
      ) : null}
      {dispatchable ? (
        <p className={`text-small ${styles.banner}`} id="admin-dispatch-hint">
          {ADMIN_ORDER_DISPATCH_HINT}
        </p>
      ) : null}
      <div className={styles.filterActions}>
        {dispatchable ? (
          <Button
            type="submit"
            name="intent"
            value="dispatch"
            variant="primary"
            loading={pending}
            aria-describedby="admin-dispatch-hint"
          >
            {pending ? ADMIN_ORDER_SAVING : ADMIN_ORDER_DISPATCH}
          </Button>
        ) : null}
        <Button
          type="submit"
          name="intent"
          value="save"
          variant={dispatchable ? "secondary" : "primary"}
          loading={pending}
        >
          {pending
            ? ADMIN_ORDER_SAVING
            : state.status === "error" || state.status === "forbidden"
              ? ADMIN_ORDERS_RETRY
              : state.status === "ok"
                ? ADMIN_ORDER_UPDATE_SAVED
                : ADMIN_ORDER_SAVE_FULFILMENT}
        </Button>
      </div>
    </form>
  );
}

function FormStatus({
  state,
  pending,
}: {
  state: AdminOrderActionState;
  pending: boolean;
}) {
  if (pending) {
    return (
      <p className={`text-small ${styles.banner}`} role="status">
        {ADMIN_ORDER_SAVING}…
      </p>
    );
  }
  if (state.status === "ok") {
    return (
      <p className={`text-small ${styles.banner}`} role="status">
        {ADMIN_ORDER_UPDATE_SAVED}
      </p>
    );
  }
  if (state.status === "error" || state.status === "forbidden") {
    return (
      <p className={`text-small ${styles.banner}`} role="alert">
        {ADMIN_ORDER_SAVE_FAILED_TITLE}. {state.message}
      </p>
    );
  }
  return null;
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canDispatchOrder } from "../src/contracts/fulfilment/dispatch";
import {
  cancellationSettlement,
  countPendingRefundAlerts,
  decideMarkRefunded,
  evaluateCancellationEligibility,
  isCancellationDispatchLock,
  refundObligationUrgency,
  shouldRecordRefundMarkedEvent,
  toPendingRefundAlert,
} from "../src/contracts/order/cancellation";
import { cancellationResultMessage, REFUND_PENDING_CUSTOMER_NOTICE } from "../src/lib/cancellation-copy";

const created = "2026-10-03T10:00:00.000Z";
const within = new Date("2026-10-03T18:00:00.000Z");
const after = new Date("2026-10-03T22:00:00.001Z");
const exactly = new Date("2026-10-03T22:00:00.000Z");

function expectEligible(
  label: string,
  decision: { eligible: boolean; reason?: string },
  eligible: boolean,
  reason?: string,
) {
  if (decision.eligible !== eligible || (!eligible && "reason" in decision && decision.reason !== reason)) {
    throw new Error(`${label}: expected ${eligible ? "eligible" : reason}, received ${JSON.stringify(decision)}`);
  }
}

expectEligible(
  "within 12 hours before dispatch",
  evaluateCancellationEligibility({
    createdAt: created,
    now: within,
    paymentStatus: "captured",
    orderStatus: "placed",
    shipmentStatus: "pending",
    shippedAt: null,
  }),
  true,
);

expectEligible(
  "after 12 hours",
  evaluateCancellationEligibility({
    createdAt: created,
    now: after,
    paymentStatus: "captured",
    orderStatus: "placed",
  }),
  false,
  "window_closed",
);

expectEligible(
  "exactly 12 hours",
  evaluateCancellationEligibility({
    createdAt: created,
    now: exactly,
    paymentStatus: "captured",
    orderStatus: "processing",
  }),
  false,
  "window_closed",
);

expectEligible(
  "shipping confirmation",
  evaluateCancellationEligibility({
    createdAt: created,
    now: within,
    paymentStatus: "captured",
    orderStatus: "placed",
    shipmentStatus: "dispatched",
    shippedAt: within.toISOString(),
  }),
  false,
  "already_shipped",
);

expectEligible(
  "pending shipment draft",
  evaluateCancellationEligibility({
    createdAt: created,
    now: within,
    paymentStatus: "captured",
    orderStatus: "processing",
    shipmentStatus: "pending",
    shippedAt: null,
  }),
  true,
);

expectEligible(
  "repeated cancellation",
  evaluateCancellationEligibility({
    createdAt: created,
    now: within,
    paymentStatus: "refunded",
    orderStatus: "placed",
  }),
  false,
  "already_cancelled",
);

expectEligible(
  "failed payment",
  evaluateCancellationEligibility({
    createdAt: created,
    now: within,
    paymentStatus: "failed",
    orderStatus: "placed",
  }),
  false,
  "not_a_purchase",
);

expectEligible(
  "captured payment",
  evaluateCancellationEligibility({
    createdAt: created,
    now: within,
    paymentStatus: "captured",
    orderStatus: "placed",
  }),
  true,
);

expectEligible(
  "order status already dispatched",
  evaluateCancellationEligibility({
    createdAt: created,
    now: within,
    paymentStatus: "captured",
    orderStatus: "dispatched",
    shipmentStatus: null,
    shippedAt: null,
  }),
  false,
  "already_shipped",
);

expectEligible(
  "unpaid placed order",
  evaluateCancellationEligibility({
    createdAt: created,
    now: within,
    paymentStatus: "created",
    orderStatus: "placed",
  }),
  true,
);

expectEligible(
  "cancelled while payment still captured",
  evaluateCancellationEligibility({
    createdAt: created,
    now: within,
    paymentStatus: "captured",
    orderStatus: "placed",
    cancelledAt: within.toISOString(),
    refundStatus: "refund_pending",
  }),
  false,
  "already_cancelled",
);

const paid = cancellationSettlement("captured");
const unpaid = cancellationSettlement("created");
const failed = cancellationSettlement("failed");
if (!paid || paid.orderState !== "cancelled" || paid.refundStatus !== "refund_pending") {
  throw new Error("A captured cancellation must be CANCELLED and REFUND_PENDING.");
}
if (!unpaid || unpaid.orderState !== "cancelled" || unpaid.refundStatus !== null) {
  throw new Error("An unpaid cancellation must be CANCELLED with no refund obligation.");
}
if (failed) {
  throw new Error("A failed payment must not create a cancellation settlement.");
}

if (!isCancellationDispatchLock({ cancelledAt: within.toISOString(), refundStatus: "refund_pending" })) {
  throw new Error("Refund-pending orders must be undispatchable.");
}
if (!isCancellationDispatchLock({ cancelledAt: within.toISOString(), refundStatus: null })) {
  throw new Error("Cancelled orders must be undispatchable even without a refund.");
}
if (isCancellationDispatchLock({ cancelledAt: null, refundStatus: null })) {
  throw new Error("An open captured order must not be locked by the cancellation rule alone.");
}
if (
  canDispatchOrder({
    paymentStatus: "captured",
    orderStatus: "placed",
    shipmentStatus: null,
    cancelledAt: within.toISOString(),
    refundStatus: "refund_pending",
  })
) {
  throw new Error("Dispatch must refuse a captured order that is refund pending.");
}

const cancelledAt = "2026-10-01T10:00:00.000Z";
const pendingNow = new Date("2026-10-02T10:00:00.000Z");
const approachingNow = new Date("2026-10-03T10:00:00.000Z");
const overdueNow = new Date("2026-10-04T10:00:00.001Z");
if (refundObligationUrgency(cancelledAt, pendingNow) !== "pending") {
  throw new Error("A fresh refund obligation is pending.");
}
if (refundObligationUrgency(cancelledAt, approachingNow) !== "approaching") {
  throw new Error("A refund inside the last day of the window is approaching.");
}
if (refundObligationUrgency(cancelledAt, overdueNow) !== "overdue") {
  throw new Error("A refund past three days is overdue.");
}

const rows = [
  { refundStatus: "refund_pending" as const },
  { refundStatus: "refund_pending" as const },
  { refundStatus: "refunded" as const },
  { refundStatus: null },
];
if (countPendingRefundAlerts(rows) !== 2) {
  throw new Error("The dashboard count must include only refund-pending orders.");
}
const overdueAlert = toPendingRefundAlert({
  id: "order-1",
  orderReference: "4821",
  amountMinor: 8900,
  cancelledAt,
  now: overdueNow,
  href: "/admin/orders/order-1",
});
if (!overdueAlert || overdueAlert.urgency !== "overdue") {
  throw new Error("An overdue refund must stay visible as overdue.");
}
if (countPendingRefundAlerts([{ refundStatus: "refunded" }]) !== 0) {
  throw new Error("A marked refund must leave the pending alert list.");
}

if (decideMarkRefunded({ actorIsAdmin: false, cancelledAt, refundStatus: "refund_pending" }).ok) {
  throw new Error("A non-admin must not mark a refund.");
}
const marked = decideMarkRefunded({ actorIsAdmin: true, cancelledAt, refundStatus: "refund_pending" });
if (!marked.ok || marked.duplicate || !shouldRecordRefundMarkedEvent(marked)) {
  throw new Error("A pending refund must move to refunded and record one event.");
}
const duplicate = decideMarkRefunded({ actorIsAdmin: true, cancelledAt, refundStatus: "refunded" });
if (!duplicate.ok || !duplicate.duplicate || shouldRecordRefundMarkedEvent(duplicate)) {
  throw new Error("Marking an already refunded order must be idempotent and must not record another event.");
}
const openOrder = decideMarkRefunded({ actorIsAdmin: true, cancelledAt: null, refundStatus: null });
if (openOrder.ok) {
  throw new Error("An order that is not cancelled cannot be marked refunded.");
}
if (openOrder.reason !== "not_cancelled") {
  throw new Error("An order that is not cancelled cannot be marked refunded.");
}
const unpaidMark = decideMarkRefunded({ actorIsAdmin: true, cancelledAt, refundStatus: null });
if (unpaidMark.ok) {
  throw new Error("An unpaid cancellation has no refund to mark.");
}
if (unpaidMark.reason !== "not_pending") {
  throw new Error("An unpaid cancellation has no refund to mark.");
}

const done = cancellationResultMessage("cancelled").toLowerCase();
if (!cancellationResultMessage("ineligible", "window_closed").toLowerCase().includes("statutory")) {
  throw new Error("Closed-window copy must preserve statutory rights.");
}
if (!done.includes("cancelled") || !done.includes("separately")) {
  throw new Error("Successful cancellation must say the order is cancelled and that any refund is separate.");
}
if (done.includes("completed") || done.includes("paypal") || done.includes("refunded")) {
  throw new Error("Successful cancellation must not say the refund is completed.");
}
if (REFUND_PENDING_CUSTOMER_NOTICE.toLowerCase().includes("completed")) {
  throw new Error("Customer refund copy must not say the refund is completed.");
}

const source = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261003123000_manual_refund_obligation.sql"),
  "utf8",
);
if (!source.includes("for update") || !source.includes("order_not_dispatchable") || !source.includes("12 hours")) {
  throw new Error("Cancellation migration must lock the order and block dispatch.");
}
if (!source.includes("v_cancelled is not null or v_refund in ('refund_pending', 'refunded')")) {
  throw new Error("Dispatch must reject cancelled and refund-tracked orders even when payment is captured.");
}
if (source.includes("payment_status = 'refunded'") || source.includes("set status = 'refunded'")) {
  throw new Error("Cancellation must not mark the payment refunded.");
}
if (!source.includes("refund_status = 'refund_pending'") || !source.includes("payment_action', 'none'")) {
  throw new Error("A captured cancellation must record a manual refund obligation and must not request a PayPal refund.");
}
if (!source.includes("revoke all on function public.cancel_order_if_eligible")) {
  throw new Error("Cancellation RPC must not be executable by storefront roles.");
}
if (!source.includes("revoke all on function public.mark_order_refunded")) {
  throw new Error("Mark-refunded RPC must not be executable by storefront roles.");
}
if (!source.includes("'already_refunded'") || !source.includes("order_refund_marked")) {
  throw new Error("Mark-refunded must be idempotent and must write an order event.");
}

const cancellationService = readFileSync(resolve(process.cwd(), "src/services/order-cancellation.ts"), "utf8");
if (
  cancellationService.includes("refundPayPalCapture") ||
  cancellationService.includes("refund-capture") ||
  cancellationService.toLowerCase().includes("paypal")
) {
  throw new Error("Cancellation must not call PayPal.");
}
const refundService = readFileSync(resolve(process.cwd(), "src/services/order-refund.ts"), "utf8");
if (!refundService.includes("getAdminGate") || !refundService.includes("isStaffAdmin")) {
  throw new Error("Mark-refunded must check an authenticated admin role on the server.");
}
if (/refundPayPalCapture|paypalFetch|\/v2\/payments\/captures/.test(refundService)) {
  throw new Error("Mark-refunded must not call PayPal.");
}
if (existsSync(resolve(process.cwd(), "src/lib/paypal/refund-capture.ts"))) {
  throw new Error("The PayPal refund client must not remain on the cancellation path.");
}

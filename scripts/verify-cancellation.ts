import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateCancellationEligibility } from "../src/contracts/order/cancellation";
import { cancellationResultMessage } from "../src/lib/cancellation-copy";

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

if (!cancellationResultMessage("ineligible", "window_closed").toLowerCase().includes("statutory")) {
  throw new Error("Closed-window copy must preserve statutory rights.");
}
if (!cancellationResultMessage("cancelled").toLowerCase().includes("paypal")) {
  throw new Error("Successful cancellation must name the PayPal refund path.");
}

const source = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261003104500_order_cancellation_guard.sql"),
  "utf8",
);
if (!source.includes("for update") || !source.includes("order_not_dispatchable") || !source.includes("12 hours")) {
  throw new Error("Cancellation migration must lock the order and block dispatch.");
}
if (!source.includes("revoke all on function public.cancel_order_if_eligible")) {
  throw new Error("Cancellation RPC must not be executable by storefront roles.");
}

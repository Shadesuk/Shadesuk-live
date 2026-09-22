import "server-only";

import {
  guestTrackingVerified,
  GUEST_TRACKING_DUMMY_EMAIL,
  parseOrderReferenceInput,
  toGuestDeliveryAddress,
  type GuestDeliveryAddressView,
} from "@/contracts";
import { minorToMajorGbp } from "@/contracts/money";
import type { OrderItemRow, OrderRow } from "@/contracts/order/schema";
import { getOptionalAccountUser } from "@/lib/account-session";
import { readCheckoutDraft } from "@/lib/checkout-draft-store";
import { readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import { parseOrderItemRow, parseOrderRow } from "@/lib/order-rows";
import { createSupabasePaymentCaptureStore } from "@/lib/payment/capture-store";
import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getOwnCustomerOrder } from "@/services/customer-orders";

export type CheckoutConfirmationView = {
  orderId: string;
  orderReference: string;
  customerEmail: string;
  items: Array<{
    productName: string;
    colourName: string;
    variantName: string | null;
    quantity: number;
    lineTotal: number;
  }>;
  total: number;
  totalMinor: number;
  shippingMinor: number;
  currency: "GBP";
  deliveryAddress: GuestDeliveryAddressView | null;
  placedAt: string;
};

export type CheckoutConfirmationResult =
  | { status: "confirmed"; order: CheckoutConfirmationView }
  | { status: "not_confirmed" }
  | { status: "error" };

export type CheckoutConfirmationDependencies = {
  accountUserId?: string | null;
  accountEmail?: string | null;
  draftEmail?: string | null;
  sessionId?: string | null;
  loadAccountOrder?: typeof getOwnCustomerOrder;
  loadOrderByReference?: (orderReference: string) => Promise<{
    order: OrderRow;
    items: OrderItemRow[];
  } | null>;
  convertCheckoutCart?: (input: {
    userId: string | null;
    sessionId: string | null;
  }) => Promise<unknown>;
};

/**
 * Server-authoritative confirmation. Shows captured-order content only when
 * payment_status is captured and the signed-in owner or checkout-draft email
 * matches. A client success flag is never consulted.
 */
export async function loadCapturedCheckoutConfirmation(
  orderReferenceInput: unknown,
  dependencies?: CheckoutConfirmationDependencies,
): Promise<CheckoutConfirmationResult> {
  const reference =
    typeof orderReferenceInput === "string" ? parseOrderReferenceInput(orderReferenceInput) : null;
  if (!reference) {
    return { status: "not_confirmed" };
  }

  const accountUserId = dependencies?.accountUserId;
  const accountEmail = dependencies?.accountEmail;
  const hasAccount =
    accountUserId !== undefined
      ? Boolean(accountUserId)
      : Boolean((await getOptionalAccountUser())?.id);

  if (hasAccount) {
    const loadAccount = dependencies?.loadAccountOrder ?? getOwnCustomerOrder;
    const own = await loadAccount(reference);
    if (own.status === "error") {
      return { status: "error" };
    }
    if (own.status === "ok" && own.data.paymentState === "PAYMENT_SUCCEEDED") {
      const user = accountEmail !== undefined ? { email: accountEmail } : await getOptionalAccountUser();
      const view = accountView(own.data, user?.email ?? "");
      await convertCheckoutCartIfSafe(view, dependencies);
      return { status: "confirmed", order: view };
    }
    if (own.status === "ok") {
      return { status: "not_confirmed" };
    }
  }

  const draftEmail =
    dependencies?.draftEmail !== undefined
      ? dependencies.draftEmail
      : (await readCheckoutDraft(await readGuestCartSessionId())).email;
  const loadOrder = dependencies?.loadOrderByReference ?? loadCapturedOrderByReference;
  const loaded = await loadOrder(reference);
  if (!loaded) {
    consumeDummyCompare(draftEmail);
    return { status: "not_confirmed" };
  }
  const matched = guestTrackingVerified({
    orderReference: loaded.order.order_reference,
    requestEmail: draftEmail || GUEST_TRACKING_DUMMY_EMAIL,
    orderEmail: loaded.order.customer_email,
  });
  if (!matched || loaded.order.payment_status !== "captured") {
    return { status: "not_confirmed" };
  }

  const view = orderView(loaded.order, loaded.items);
  await convertCheckoutCartIfSafe(view, dependencies);
  return { status: "confirmed", order: view };
}

async function convertCheckoutCartIfSafe(
  view: CheckoutConfirmationView,
  dependencies?: CheckoutConfirmationDependencies,
): Promise<void> {
  try {
    const user = await resolveUser(dependencies);
    const sessionId =
      dependencies?.sessionId !== undefined
        ? dependencies.sessionId
        : user.userId
          ? null
          : await readGuestCartSessionId();
    const convert =
      dependencies?.convertCheckoutCart ??
      ((input: { userId: string | null; sessionId: string | null }) =>
        createSupabasePaymentCaptureStore().convertActiveCheckoutCart(input));
    await convert({ userId: user.userId, sessionId });
    void view;
  } catch {
    // Confirmation must not fail if cart conversion cannot run.
  }
}

async function resolveUser(dependencies?: CheckoutConfirmationDependencies): Promise<{
  userId: string | null;
}> {
  if (dependencies?.accountUserId !== undefined) {
    return { userId: dependencies.accountUserId };
  }
  return { userId: (await getOptionalAccountUser())?.id ?? null };
}

function consumeDummyCompare(draftEmail: string | null | undefined): void {
  guestTrackingVerified({
    orderReference: "SHU-000000000000",
    requestEmail: draftEmail || GUEST_TRACKING_DUMMY_EMAIL,
    orderEmail: GUEST_TRACKING_DUMMY_EMAIL,
  });
}

function accountView(
  order: {
    orderReference: string;
    placedAt: string;
    items: Array<{
      productName: string;
      colourName: string;
      variantName: string | null;
      quantity: number;
      lineTotal: number;
    }>;
    total: number;
    totalMinor: number;
    shippingMinor: number;
    deliveryAddress: GuestDeliveryAddressView | null;
  },
  email: string,
): CheckoutConfirmationView {
  return {
    orderId: order.orderReference,
    orderReference: order.orderReference,
    customerEmail: email,
    items: order.items.map((item) => ({
      productName: item.productName,
      colourName: item.colourName,
      variantName: item.variantName,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    total: order.total,
    totalMinor: order.totalMinor,
    shippingMinor: order.shippingMinor,
    currency: "GBP",
    deliveryAddress: order.deliveryAddress,
    placedAt: order.placedAt,
  };
}

function orderView(order: OrderRow, items: OrderItemRow[]): CheckoutConfirmationView {
  return {
    orderId: order.id,
    orderReference: order.order_reference,
    customerEmail: order.customer_email,
    items: items.map((item) => ({
      productName: item.product_name,
      colourName: item.colour_name,
      variantName: item.variant_name,
      quantity: item.quantity,
      lineTotal: minorToMajorGbp(item.line_total_minor),
    })),
    total: minorToMajorGbp(order.total_minor),
    totalMinor: order.total_minor,
    shippingMinor: order.shipping_minor,
    currency: "GBP",
    deliveryAddress: toGuestDeliveryAddress(order.delivery_address),
    placedAt: order.created_at,
  };
}

async function loadCapturedOrderByReference(
  orderReference: string,
): Promise<{ order: OrderRow; items: OrderItemRow[] } | null> {
  if (!isSupabaseConfigured() || !hasSupabaseSecretKey()) {
    return null;
  }
  const admin = createSupabaseAdminClient();
  const orderResult = await admin
    .from("orders")
    .select(
      "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, currency, subtotal_minor, shipping_minor, total_minor, delivery_address, created_at, updated_at",
    )
    .eq("order_reference", orderReference)
    .maybeSingle();
  const order = parseOrderRow(orderResult.data);
  if (orderResult.error || !order) {
    return null;
  }
  const itemResult = await admin
    .from("order_items")
    .select(
      "id, order_id, product_id, product_variant_id, sku, product_name, colour_name, variant_name, quantity, unit_price_minor, line_total_minor, product_snapshot, created_at",
    )
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });
  const items = Array.isArray(itemResult.data)
    ? itemResult.data
        .map(parseOrderItemRow)
        .filter((row): row is OrderItemRow => row !== null && row.order_id === order.id)
    : [];
  return { order, items };
}

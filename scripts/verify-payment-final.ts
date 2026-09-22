import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { orderConfirmationIdempotencyKey } from "../src/lib/email/idempotency";
import { createMemoryEmailEventStore } from "../src/lib/email/memory-store";
import { dispatchOrderConfirmationEmail } from "../src/lib/email/order-confirmation";
import { onVerifiedPaymentCaptured } from "../src/lib/payment/after-captured";
import { captureVerifiedRazorpayPayment } from "../src/lib/payment/capture-verified";
import { loadCapturedCheckoutConfirmation } from "../src/services/checkout-confirmation";
import { resetPurchaseDedupeForTests, trackPurchaseOnce, registerAnalyticsProvider } from "../src/lib/analytics";
import { PAYMENT_PROVIDER_RAZORPAY } from "../src/contracts/payment/schema";
import { STORE_CURRENCY } from "../src/contracts/money";
import { orderConfirmationPath, routes } from "../src/lib/navigation";
import type { OrderRow } from "../src/contracts/order/schema";
import type { CustomerOrderView } from "../src/contracts/order/dto";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

if (PAYMENT_PROVIDER_RAZORPAY !== "razorpay" || STORE_CURRENCY !== "GBP") {
  throw new Error("Production payment must stay Razorpay + GBP.");
}

if (routes.checkoutConfirmation !== "/checkout/confirmation") {
  throw new Error("Confirmation route must stay /checkout/confirmation.");
}
if (!orderConfirmationPath("SHU-ABCDEFGHJKMN").includes("/checkout/confirmation")) {
  throw new Error("Confirmation path must use the checkout confirmation route.");
}

const envExample = read(".env.example");
for (const name of [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_ORDER_CONFIRMATION_TEMPLATE_ID",
  "RESEND_WEBHOOK_SECRET",
] as const) {
  if (!envExample.includes(`${name}=`)) {
    throw new Error(`.env.example must document ${name}.`);
  }
}
if (envExample.includes("NEXT_PUBLIC_RAZORPAY_KEY_ID=") || envExample.includes("NEXT_PUBLIC_RAZORPAY_KEY_SECRET=")) {
  throw new Error("Razorpay Checkout must not use a NEXT_PUBLIC_ key.");
}

const route = read("src/app/api/webhooks/razorpay/route.ts");
if (!route.includes("export async function POST") || route.includes("export async function GET")) {
  throw new Error("Razorpay webhook must remain POST /api/webhooks/razorpay.");
}

const captureWrites = [
  "src/lib/payment/capture-store.ts",
];
const forbiddenCaptureWrites = [
  "src/lib/payment/verify-checkout.ts",
  "src/lib/payment/handle-webhook.ts",
  "src/app/api/webhooks/razorpay/route.ts",
  "src/components/checkout/CheckoutReview.tsx",
  "src/app/(storefront)/checkout/confirmation/page.tsx",
];
for (const file of forbiddenCaptureWrites) {
  const source = read(file);
  if (source.includes('status: "captured"') && file.includes("capture-store") === false) {
    if (file.includes("verify-checkout") || file.includes("handle-webhook") || file.includes("CheckoutReview") || file.includes("confirmation")) {
      throw new Error(`${file} must not write captured payment state.`);
    }
  }
  if (source.includes("dispatchOrderConfirmationEmail")) {
    throw new Error(`${file} must not dispatch email directly.`);
  }
}
if (!read(captureWrites[0]).includes('status: "captured"') || !read(captureWrites[0]).includes('payment_status: "captured"')) {
  throw new Error("Capture store must remain the only captured-state writer.");
}

const afterCaptured = read("src/lib/payment/after-captured.ts");
if (!afterCaptured.includes("dispatchOrderConfirmationEmail(orderId)")) {
  throw new Error("Capture hook must reach the PR #46 dispatcher.");
}

const ORDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
if (orderConfirmationIdempotencyKey(ORDER_ID) !== `order_confirmation:${ORDER_ID}`) {
  throw new Error("Email idempotency must remain order_confirmation:{order_id}.");
}

const capturedOrder: OrderRow = {
  id: ORDER_ID,
  order_reference: "SHU-ABCDEFGHJKMN",
  user_id: null,
  customer_email: "ada@shadesuk.example",
  customer_first_name: "Ada",
  customer_last_name: "Lovelace",
  status: "placed",
  payment_status: "captured",
  currency: "GBP",
  subtotal_minor: 4900,
  shipping_minor: 465,
  total_minor: 5365,
  delivery_address: { first_name: "Ada", last_name: "Lovelace" },
  created_at: "2026-09-22T12:00:00.000Z",
  updated_at: "2026-09-22T12:00:00.000Z",
};

void (async () => {
  let emailCalls = 0;
  const emailStore = createMemoryEmailEventStore();
  const emailDeps = {
    loadOrder: async () => ({
      order: capturedOrder,
      items: [],
    }),
    send: async (_payload: unknown, options?: { idempotencyKey?: string }) => {
      emailCalls += 1;
      if (options?.idempotencyKey !== `order_confirmation:${ORDER_ID}`) {
        throw new Error("Dispatcher must pass order_confirmation:{order_id}.");
      }
      return { success: true as const, messageId: "msg_1" };
    },
    store: emailStore,
  };
  const emailed = await dispatchOrderConfirmationEmail(ORDER_ID, emailDeps);
  const emailedAgain = await dispatchOrderConfirmationEmail(ORDER_ID, emailDeps);
  if (emailed.outcome !== "sent" || emailedAgain.outcome !== "skipped" || emailCalls !== 1) {
    throw new Error("Captured order must reach the PR #46 dispatcher once per order.");
  }

  const unpaid = await dispatchOrderConfirmationEmail(ORDER_ID, {
    loadOrder: async () => ({
      order: { ...capturedOrder, payment_status: "created" },
      items: [],
    }),
    send: async () => {
      throw new Error("unpaid must not send");
    },
  });
  if (unpaid.outcome !== "skipped") {
    throw new Error("Unpaid orders must not send confirmation email.");
  }

  let hookFailed = false;
  try {
    await onVerifiedPaymentCaptured("not-a-uuid");
  } catch {
    hookFailed = true;
  }
  if (hookFailed) {
    throw new Error("Email hook failure must be swallowed by the dispatcher.");
  }

  const confirmed = await loadCapturedCheckoutConfirmation("SHU-ABCDEFGHJKMN", {
    accountUserId: null,
    draftEmail: "ada@shadesuk.example",
    sessionId: "guest-session",
    loadOrderByReference: async () => ({
      order: capturedOrder,
      items: [],
    }),
    convertCheckoutCart: async () => "converted",
  });
  if (confirmed.status !== "confirmed" || confirmed.order.orderReference !== "SHU-ABCDEFGHJKMN") {
    throw new Error("Captured guest order with matching draft email must show confirmation.");
  }

  const unpaidPage = await loadCapturedCheckoutConfirmation("SHU-ABCDEFGHJKMN", {
    accountUserId: null,
    draftEmail: "ada@shadesuk.example",
    loadOrderByReference: async () => ({
      order: { ...capturedOrder, payment_status: "created" },
      items: [],
    }),
  });
  if (unpaidPage.status !== "not_confirmed") {
    throw new Error("Unpaid order cannot show confirmed state.");
  }

  const stranger = await loadCapturedCheckoutConfirmation("SHU-ABCDEFGHJKMN", {
    accountUserId: null,
    draftEmail: "eve@example.com",
    loadOrderByReference: async () => ({
      order: capturedOrder,
      items: [],
    }),
  });
  if (stranger.status !== "not_confirmed") {
    throw new Error("Guest order access must stay protected.");
  }

  const accountOrder = {
    orderReference: "SHU-ABCDEFGHJKMN",
    status: "placed",
    statusLabel: "ORDER PLACED",
    placedAt: capturedOrder.created_at,
    customerFirstName: "Ada",
    customerLastName: "Lovelace",
    items: [],
    currency: "GBP",
    subtotalMinor: 4900,
    shippingMinor: 465,
    totalMinor: 5365,
    subtotal: 49,
    shipping: 4.65,
    total: 53.65,
    deliveryAddress: null,
    paymentState: "PAYMENT_SUCCEEDED",
    shipment: null,
    events: [],
    cancelled: false,
  } as CustomerOrderView;
  const accountConfirmed = await loadCapturedCheckoutConfirmation("SHU-ABCDEFGHJKMN", {
    accountUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    accountEmail: "ada@shadesuk.example",
    loadAccountOrder: async () => ({ status: "ok", data: accountOrder }),
    convertCheckoutCart: async () => "converted",
  });
  if (accountConfirmed.status !== "confirmed") {
    throw new Error("Captured account order must show confirmation.");
  }

  resetPurchaseDedupeForTests();
  const purchases: string[] = [];
  registerAnalyticsProvider({
    track(name, payload) {
      if (name === "purchase") {
        purchases.push(String(payload?.item_id ?? ""));
      }
    },
  });
  trackPurchaseOnce("SHU-ABCDEFGHJKMN", { currency: "GBP", value: 53.65 });
  trackPurchaseOnce("SHU-ABCDEFGHJKMN", { currency: "GBP", value: 53.65 });
  if (purchases.length !== 1) {
    throw new Error("Refresh must not create duplicate purchase events.");
  }
  registerAnalyticsProvider(null);

  const captureSource = read("src/lib/payment/capture-verified.ts");
  if (!captureSource.includes("onVerifiedPaymentCaptured") || captureSource.includes("from \"resend\"")) {
    throw new Error("Capture writer must remain the email boundary.");
  }
  if (!existsSync(resolve(root, "src/app/(storefront)/checkout/confirmation/page.tsx"))) {
    throw new Error("Missing confirmation page.");
  }
  if (read("src/lib/razorpay/open-checkout.ts").includes("RAZORPAY_KEY_SECRET")) {
    throw new Error("Checkout.js must receive only the public key.");
  }

  void captureVerifiedRazorpayPayment;

  console.log("verify-payment-final: ok");
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import { createOrderReference } from "@/contracts/order/reference";
import type { PaymentStatus } from "@/contracts/order/schema";
import { PAYMENT_PROVIDER_PAYPAL } from "@/contracts/payment/schema";
import { STORE_CURRENCY } from "@/contracts/money";
import {
  checkoutQuoteFromLock,
  liveTotalUndercutsLock,
  lockCoversLines,
  quoteLockExpired,
  quoteLockForCountry,
} from "@/lib/checkout-quote-lock";
import {
  authoritativeCheckoutQuote,
  quoteIsChargeable,
  type CheckoutQuote,
} from "@/lib/checkout-quote";
import { resolveShippingOptions } from "@/lib/shipping/options";
import {
  formatUkPostcode,
  hasCheckoutFieldErrors,
  normalizeCountry,
  normalizeEmailInput,
  validateDeliverableCheckoutAddress,
  validateCheckoutEmail,
} from "@/lib/checkout-validate";
import type { CheckoutFieldErrors, PublicCheckoutDraft } from "@/types/checkout";

export type PendingPaymentLine = {
  productId: string;
  productVariantId: string;
  sku: string;
  productName: string;
  colourName: string;
  variantName: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  productSnapshot?: Record<string, unknown>;
};

/** Client money fields are accepted only so they can be ignored. */
export type ClientMoneyOverride = {
  subtotalMinor?: number;
  shippingMinor?: number;
  totalMinor?: number;
  currency?: string;
  subtotal?: number;
  shipping?: number;
  total?: number;
};

export type PendingOrderInsert = {
  order_reference: string;
  user_id: string | null;
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  status: "checkout";
  payment_status: Extract<PaymentStatus, "created">;
  currency: typeof STORE_CURRENCY;
  subtotal_minor: number;
  shipping_minor: number;
  total_minor: number;
  delivery_address: Record<string, unknown>;
};

export type PendingOrderItemInsert = {
  product_id: string;
  product_variant_id: string;
  sku: string;
  product_name: string;
  colour_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
  product_snapshot: Record<string, unknown> | null;
};

export type PendingPaymentInsert = {
  provider: typeof PAYMENT_PROVIDER_PAYPAL;
  amount_minor: number;
  currency: typeof STORE_CURRENCY;
  status: Extract<PaymentStatus, "created">;
};

export type PendingPaymentAttempt = {
  quote: CheckoutQuote;
  order: PendingOrderInsert;
  items: PendingOrderItemInsert[];
  payment: PendingPaymentInsert;
  paypal: {
    amountMinor: number;
    currency: typeof STORE_CURRENCY;
    /** Mapped to purchase_units[].invoice_id when length ≤ 127. */
    invoiceId: string;
  };
};

export type BuildPendingPaymentAttemptResult =
  | { ok: true; attempt: PendingPaymentAttempt }
  | { ok: false; reason: "invalid"; errors: CheckoutFieldErrors }
  | { ok: false; reason: "empty" | "expired" | "blocked" };

export function quotePendingPaymentLines(
  lines: readonly PendingPaymentLine[],
  client?: ClientMoneyOverride,
  country?: string,
): CheckoutQuote {
  const subtotalMinor = lines.reduce((sum, line) => {
    if (!Number.isInteger(line.lineTotalMinor) || line.lineTotalMinor < 0) {
      return sum;
    }
    return sum + line.lineTotalMinor;
  }, 0);
  return authoritativeCheckoutQuote({
    subtotalMinor,
    shippingMinor: client?.shippingMinor,
    totalMinor: client?.totalMinor,
    currency: client?.currency,
    subtotal: client?.subtotal,
    shipping: client?.shipping,
    total: client?.total,
    country,
  });
}

export function buildPendingPaymentAttempt(input: {
  draft: PublicCheckoutDraft;
  lines: readonly PendingPaymentLine[];
  userId?: string | null;
  clientQuote?: ClientMoneyOverride;
  createReference?: () => string;
  now?: number;
}): BuildPendingPaymentAttemptResult {
  if (input.draft.expired) {
    return { ok: false, reason: "expired" };
  }
  if (input.lines.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const email = normalizeEmailInput(input.draft.email);
  const errors: CheckoutFieldErrors = {
    ...validateCheckoutEmail(email),
    ...validateDeliverableCheckoutAddress({
      firstName: input.draft.firstName,
      lastName: input.draft.lastName,
      line1: input.draft.line1,
      city: input.draft.city,
      postcode: input.draft.postcode,
      country: input.draft.country,
    }),
  };
  if (hasCheckoutFieldErrors(errors)) {
    return { ok: false, reason: "invalid", errors };
  }

  for (const line of input.lines) {
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      !Number.isInteger(line.unitPriceMinor) ||
      line.unitPriceMinor < 0 ||
      line.lineTotalMinor !== line.unitPriceMinor * line.quantity
    ) {
      return { ok: false, reason: "blocked" };
    }
  }

  const country = normalizeCountry(input.draft.country);
  const now = input.now ?? Date.now();
  if (input.draft.lockExpired || (input.draft.quoteLock != null && quoteLockExpired(input.draft.quoteLock, now))) {
    return { ok: false, reason: "blocked" };
  }
  const held = quoteLockForCountry(input.draft.quoteLock, country);
  let lines = input.lines;
  let quote: CheckoutQuote;
  if (input.draft.quoteLock) {
    if (!held || held.paymentProvider !== "paypal" || !lockCoversLines(held, linesForLock(input.lines))) {
      return { ok: false, reason: "blocked" };
    }
    const resolved = resolveShippingOptions(country);
    if (resolved.status === "priced") {
      const liveSubtotal = input.lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
      const liveShipping = resolved.options[0]?.amountMinor ?? 0;
      if (liveTotalUndercutsLock(held, liveSubtotal + liveShipping)) {
        return { ok: false, reason: "blocked" };
      }
    }
    lines = input.lines.map((line) => {
      const locked = held.lines.find((entry) => entry.variantId === line.productVariantId);
      const unitPriceMinor = locked?.unitPriceMinor ?? line.unitPriceMinor;
      return {
        ...line,
        unitPriceMinor,
        lineTotalMinor: unitPriceMinor * line.quantity,
      };
    });
    quote = checkoutQuoteFromLock(held);
  } else {
    quote = quotePendingPaymentLines(lines, input.clientQuote, country);
    if (resolveShippingOptions(country).status !== "priced") {
      return { ok: false, reason: "blocked" };
    }
  }
  if (quote.currency !== STORE_CURRENCY || !quoteIsChargeable(quote)) {
    return { ok: false, reason: "blocked" };
  }
  const chargedSubtotal = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  if (chargedSubtotal !== quote.subtotalMinor) {
    return { ok: false, reason: "blocked" };
  }

  const reference = (input.createReference ?? createOrderReference)();
  const firstName = input.draft.firstName.trim();
  const lastName = input.draft.lastName.trim();
  const postcode = country === "GB" ? formatUkPostcode(input.draft.postcode) : input.draft.postcode.trim();

  const attempt: PendingPaymentAttempt = {
    quote,
    order: {
      order_reference: reference,
      user_id: input.userId ?? null,
      customer_email: email,
      customer_first_name: firstName,
      customer_last_name: lastName,
      status: "checkout",
      payment_status: "created",
      currency: STORE_CURRENCY,
      subtotal_minor: quote.subtotalMinor,
      shipping_minor: quote.shippingMinor,
      total_minor: quote.totalMinor,
      delivery_address: {
        first_name: firstName,
        last_name: lastName,
        address_line_1: input.draft.line1.trim(),
        address_line_2: input.draft.line2.trim(),
        city: input.draft.city.trim(),
        county: input.draft.county.trim(),
        postcode,
        country,
      },
    },
    items: lines.map((line) => ({
      product_id: line.productId,
      product_variant_id: line.productVariantId,
      sku: line.sku,
      product_name: line.productName,
      colour_name: line.colourName,
      variant_name: line.variantName,
      quantity: line.quantity,
      unit_price_minor: line.unitPriceMinor,
      line_total_minor: line.lineTotalMinor,
      product_snapshot: line.productSnapshot ?? {
        sku: line.sku,
        product_name: line.productName,
        colour_name: line.colourName,
        variant_name: line.variantName,
        quantity: line.quantity,
        unit_price_minor: line.unitPriceMinor,
      },
    })),
    payment: {
      provider: PAYMENT_PROVIDER_PAYPAL,
      amount_minor: quote.totalMinor,
      currency: STORE_CURRENCY,
      status: "created",
    },
    paypal: {
      amountMinor: quote.totalMinor,
      currency: STORE_CURRENCY,
      invoiceId: reference,
    },
  };

  return { ok: true, attempt };
}

function linesForLock(lines: readonly PendingPaymentLine[]): { variantId: string; quantity: number }[] {
  return lines.map((line) => ({
    variantId: line.productVariantId,
    quantity: line.quantity,
  }));
}

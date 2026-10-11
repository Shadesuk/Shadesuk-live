import { averageOrderValueMinor } from "./dashboard";
import type { PaymentStatus } from "../order/schema";

/**
 * Admin payment totals.
 *
 * Captured and refunded money comes from payment_ledger rows in the payment
 * currency. Pending, failed, cancelled, captured, and refunded counts come
 * from payments created in the same range. A payment is in one count only.
 * Currencies are never added together. Test rows are excluded from both.
 */

export const PAYMENT_REPORT_CURRENCIES = ["GBP", "EUR", "USD", "INR"] as const;

export const PAYMENT_REPORT_UNAVAILABLE = "Not available" as const;

export type PaymentReportPayment = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  currency: string;
  createdAt: string;
};

export type PaymentReportLedgerEntry = {
  paymentId: string;
  orderId: string;
  entryType: "charge" | "refund" | "fee" | "settlement" | "adjustment";
  amountMinor: number;
  currency: string;
  occurredAt: string;
  isTest: boolean;
};

export type PaymentCurrencyTotal = {
  currency: string;
  capturedMinor: number;
  refundedMinor: number;
  chargeCount: number;
  aovMinor: number | null;
};

export type PaymentStatusCounts = {
  captured: number;
  pending: number;
  failed: number;
  cancelled: number;
  refunded: number;
};

export type PaymentReportCharge = {
  amountMinor: number;
  currency: string;
  occurredAt: string;
};

export type PaymentPeriodReport = {
  currencies: PaymentCurrencyTotal[];
  counts: PaymentStatusCounts;
  capturedOrderIds: string[];
  charges: PaymentReportCharge[];
};

const CURRENCY_ORDER = ["GBP", "EUR", "USD", "INR"];

export function buildPaymentPeriodReport(input: {
  payments: readonly PaymentReportPayment[];
  ledger: readonly PaymentReportLedgerEntry[];
  testPaymentIds?: readonly string[];
}): PaymentPeriodReport {
  const testIds = new Set(input.testPaymentIds ?? []);
  for (const entry of input.ledger) {
    if (entry.isTest) {
      testIds.add(entry.paymentId);
    }
  }

  const refundedIds = new Set<string>();
  const charges: PaymentReportCharge[] = [];
  const totals = new Map<string, { capturedMinor: number; refundedMinor: number; chargeCount: number }>();
  for (const entry of input.ledger) {
    if (entry.isTest || testIds.has(entry.paymentId)) {
      continue;
    }
    if (!Number.isInteger(entry.amountMinor) || entry.currency.trim() === "") {
      continue;
    }
    const bucket = totals.get(entry.currency) ?? {
      capturedMinor: 0,
      refundedMinor: 0,
      chargeCount: 0,
    };
    if (entry.entryType === "charge" && entry.amountMinor > 0) {
      bucket.capturedMinor += entry.amountMinor;
      bucket.chargeCount += 1;
      charges.push({
        amountMinor: entry.amountMinor,
        currency: entry.currency,
        occurredAt: entry.occurredAt,
      });
    } else if (entry.entryType === "refund" && entry.amountMinor < 0) {
      bucket.refundedMinor += -entry.amountMinor;
      refundedIds.add(entry.paymentId);
    }
    totals.set(entry.currency, bucket);
  }

  const counts: PaymentStatusCounts = {
    captured: 0,
    pending: 0,
    failed: 0,
    cancelled: 0,
    refunded: 0,
  };
  for (const payment of input.payments) {
    if (testIds.has(payment.id)) {
      continue;
    }
    const bucket = statusBucket(payment.status, refundedIds.has(payment.id));
    if (bucket) {
      counts[bucket] += 1;
    }
  }

  const capturedOrderIds: string[] = [];
  const seenOrders = new Set<string>();
  for (const entry of input.ledger) {
    if (entry.isTest || testIds.has(entry.paymentId) || refundedIds.has(entry.paymentId)) {
      continue;
    }
    if (entry.entryType !== "charge" || entry.amountMinor <= 0 || seenOrders.has(entry.orderId)) {
      continue;
    }
    seenOrders.add(entry.orderId);
    capturedOrderIds.push(entry.orderId);
  }

  const currencies = [...totals.entries()]
    .filter(([, bucket]) => bucket.capturedMinor > 0 || bucket.refundedMinor > 0)
    .sort(([left], [right]) => currencyRank(left) - currencyRank(right) || left.localeCompare(right))
    .map(([currency, bucket]) => ({
      currency,
      capturedMinor: bucket.capturedMinor,
      refundedMinor: bucket.refundedMinor,
      chargeCount: bucket.chargeCount,
      aovMinor:
        bucket.chargeCount > 0 ? averageOrderValueMinor(bucket.capturedMinor, bucket.chargeCount) : null,
    }));

  return { currencies, counts, capturedOrderIds, charges };
}

function statusBucket(
  status: PaymentStatus,
  hasRefund: boolean,
): keyof PaymentStatusCounts | null {
  if (hasRefund || status === "refunded" || status === "partially_refunded") {
    return "refunded";
  }
  if (status === "captured") {
    return "captured";
  }
  if (status === "created" || status === "authorized") {
    return "pending";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  return null;
}

function currencyRank(currency: string): number {
  const index = CURRENCY_ORDER.indexOf(currency);
  return index === -1 ? CURRENCY_ORDER.length : index;
}

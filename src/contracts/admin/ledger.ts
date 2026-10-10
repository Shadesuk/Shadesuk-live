import {
  dashboardPeriodRange,
  londonInclusiveDateRange,
  type DashboardPeriod,
} from "./dashboard";

export const LEDGER_ENTRY_TYPES = ["charge", "refund", "fee", "settlement", "adjustment"] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const LEDGER_PROVIDERS = ["paypal", "razorpay"] as const;
export type LedgerProvider = (typeof LEDGER_PROVIDERS)[number];

export const LEDGER_CURRENCIES = ["GBP", "EUR", "USD", "INR"] as const;
export type LedgerCurrency = (typeof LEDGER_CURRENCIES)[number];

export const LEDGER_STATUS_FILTERS = [
  "charge",
  "refund",
  "fee",
  "settlement",
  "adjustment",
  "pending",
  "captured",
  "failed",
  "cancelled",
  "refunded",
] as const;
export type LedgerStatusFilter = (typeof LEDGER_STATUS_FILTERS)[number];

export const LEDGER_LIST_LIMIT = 200;

export type LedgerListQuery = {
  from: string;
  to: string;
  startIso: string;
  endIso: string;
  provider: LedgerProvider | null;
  currency: LedgerCurrency | null;
  status: LedgerStatusFilter | null;
  orderRef: string;
};

export function parseLedgerListQuery(
  params: Record<string, string | string[] | undefined>,
  now = new Date(),
): LedgerListQuery {
  const fallback = dashboardPeriodRange("30d" satisfies DashboardPeriod, now);
  const from = ymdOr(readParam(params.from), fallback.dayKeys[0] ?? "");
  const to = ymdOr(readParam(params.to), fallback.dayKeys[fallback.dayKeys.length - 1] ?? "");
  const range = londonInclusiveDateRange(from, to) ?? {
    startIso: fallback.startIso,
    endIso: fallback.endIso,
  };
  const resolvedFrom = londonInclusiveDateRange(from, to) ? from : (fallback.dayKeys[0] ?? from);
  const resolvedTo = londonInclusiveDateRange(from, to)
    ? to
    : (fallback.dayKeys[fallback.dayKeys.length - 1] ?? to);
  return {
    from: resolvedFrom,
    to: resolvedTo,
    startIso: range.startIso,
    endIso: range.endIso,
    provider: oneOf(readParam(params.provider), LEDGER_PROVIDERS),
    currency: oneOf(readParam(params.currency), LEDGER_CURRENCIES),
    status: oneOf(readParam(params.status), LEDGER_STATUS_FILTERS),
    orderRef: orderRefQuery(readParam(params.q)),
  };
}

export function ledgerListQueryString(query: LedgerListQuery): string {
  const params = new URLSearchParams();
  params.set("from", query.from);
  params.set("to", query.to);
  if (query.provider) {
    params.set("provider", query.provider);
  }
  if (query.currency) {
    params.set("currency", query.currency);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.orderRef) {
    params.set("q", query.orderRef);
  }
  return params.toString();
}

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

function ymdOr(value: string, fallback: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function orderRefQuery(value: string): string {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(value)) {
    return "";
  }
  return value;
}

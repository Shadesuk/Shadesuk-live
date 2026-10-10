import "server-only";

import { isStaffAdmin } from "@/contracts/admin/roles";
import type { DashboardDateRange } from "@/contracts/admin/dashboard";
import {
  LEDGER_LIST_LIMIT,
  type LedgerEntryType,
  type LedgerListQuery,
} from "@/contracts/admin/ledger";
import {
  buildPaymentPeriodReport,
  type PaymentPeriodReport,
  type PaymentReportLedgerEntry,
  type PaymentReportPayment,
} from "@/contracts/admin/payment-report";
import { isPaymentStatus } from "@/contracts/admin/dashboard";
import { getAdminGate } from "@/lib/admin-session";
import { createSupabaseAdminClient, hasSupabaseSecretKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const PAGE_SIZE = 1000;

export type PaymentPeriodLoad =
  | { status: "ok"; report: PaymentPeriodReport }
  | { status: "error" };

export type AdminLedgerRow = {
  id: string;
  orderId: string;
  orderReference: string;
  provider: string;
  entryType: LedgerEntryType;
  amountMinor: number;
  currency: string;
  paymentStatus: string;
  providerRef: string;
  occurredAt: string;
  isTest: boolean;
};

export type AdminLedgerLoad =
  | { status: "ok"; rows: AdminLedgerRow[]; limited: boolean }
  | { status: "error" };

/**
 * Payment totals for the admin dashboard. Reads run only after the admin gate.
 * payments and payment_ledger are not granted to anon or authenticated.
 */
export async function loadPaymentPeriod(range: DashboardDateRange): Promise<PaymentPeriodLoad> {
  if (!(await adminCanReadLedger())) {
    return { status: "error" };
  }
  try {
    const admin = createSupabaseAdminClient();
    const payments = await pagePayments(admin, range);
    const ledger = await pageLedger(admin, range);
    if (!payments || !ledger) {
      return { status: "error" };
    }
    const testPaymentIds = await testPaymentIdsFor(admin, payments.map((payment) => payment.id));
    if (!testPaymentIds) {
      return { status: "error" };
    }
    return {
      status: "ok",
      report: buildPaymentPeriodReport({ payments, ledger, testPaymentIds }),
    };
  } catch {
    return { status: "error" };
  }
}

export async function loadAdminLedger(query: LedgerListQuery): Promise<AdminLedgerLoad> {
  if (!(await adminCanReadLedger())) {
    return { status: "error" };
  }
  try {
    const admin = createSupabaseAdminClient();
    let request = admin
      .from("payment_ledger")
      .select(
        "id, order_id, provider, entry_type, amount_minor, currency, provider_ref, occurred_at, is_test, payments!inner(status), orders!inner(order_reference)",
      )
      .gte("occurred_at", query.startIso)
      .lt("occurred_at", query.endIso)
      .order("occurred_at", { ascending: false })
      .limit(LEDGER_LIST_LIMIT + 1);

    if (query.provider) {
      request = request.eq("provider", query.provider);
    }
    if (query.currency) {
      request = request.eq("currency", query.currency);
    }
    if (query.orderRef) {
      request = request.ilike("orders.order_reference", `%${query.orderRef}%`);
    }
    if (
      query.status === "charge" ||
      query.status === "refund" ||
      query.status === "fee" ||
      query.status === "settlement" ||
      query.status === "adjustment"
    ) {
      request = request.eq("entry_type", query.status);
    } else if (query.status === "pending") {
      request = request.in("payments.status", ["created", "authorized"]);
    } else if (query.status === "refunded") {
      request = request.in("payments.status", ["refunded", "partially_refunded"]);
    } else if (query.status) {
      request = request.eq("payments.status", query.status);
    }

    const { data, error } = await request;
    if (error || !Array.isArray(data)) {
      return { status: "error" };
    }
    const limited = data.length > LEDGER_LIST_LIMIT;
    const rows: AdminLedgerRow[] = [];
    for (const value of data.slice(0, LEDGER_LIST_LIMIT)) {
      const row = parseLedgerRow(value);
      if (row) {
        rows.push(row);
      }
    }
    return { status: "ok", rows, limited };
  } catch {
    return { status: "error" };
  }
}

async function adminCanReadLedger(): Promise<boolean> {
  const gate = await getAdminGate();
  return gate.status === "ok" && isStaffAdmin(gate.actor.role) && isSupabaseConfigured() && hasSupabaseSecretKey();
}

async function pagePayments(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  range: DashboardDateRange,
): Promise<PaymentReportPayment[] | null> {
  const rows: PaymentReportPayment[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("payments")
      .select("id, order_id, status, currency, created_at")
      .gte("created_at", range.startIso)
      .lt("created_at", range.endIso)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      return null;
    }
    const chunk = Array.isArray(data) ? data : [];
    for (const value of chunk) {
      const row = parsePayment(value);
      if (row) {
        rows.push(row);
      }
    }
    if (chunk.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }
  return rows;
}

async function pageLedger(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  range: DashboardDateRange,
): Promise<PaymentReportLedgerEntry[] | null> {
  const rows: PaymentReportLedgerEntry[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("payment_ledger")
      .select("payment_id, order_id, entry_type, amount_minor, currency, occurred_at, is_test")
      .gte("occurred_at", range.startIso)
      .lt("occurred_at", range.endIso)
      .order("occurred_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      return null;
    }
    const chunk = Array.isArray(data) ? data : [];
    for (const value of chunk) {
      const row = parseLedgerEntry(value);
      if (row) {
        rows.push(row);
      }
    }
    if (chunk.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }
  return rows;
}

async function testPaymentIdsFor(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  paymentIds: readonly string[],
): Promise<string[] | null> {
  const ids: string[] = [];
  for (let index = 0; index < paymentIds.length; index += PAGE_SIZE) {
    const slice = paymentIds.slice(index, index + PAGE_SIZE);
    if (slice.length === 0) {
      continue;
    }
    const { data, error } = await admin
      .from("payment_ledger")
      .select("payment_id")
      .eq("is_test", true)
      .in("payment_id", [...slice]);
    if (error) {
      return null;
    }
    for (const value of Array.isArray(data) ? data : []) {
      if (value && typeof value === "object" && "payment_id" in value && typeof value.payment_id === "string") {
        ids.push(value.payment_id);
      }
    }
  }
  return ids;
}

function parsePayment(value: unknown): PaymentReportPayment | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.order_id !== "string" || !isPaymentStatus(row.status)) {
    return null;
  }
  if (typeof row.currency !== "string" || row.currency.trim() === "") {
    return null;
  }
  if (typeof row.created_at !== "string") {
    return null;
  }
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    currency: row.currency,
    createdAt: row.created_at,
  };
}

function parseLedgerEntry(value: unknown): PaymentReportLedgerEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.payment_id !== "string" || typeof row.order_id !== "string") {
    return null;
  }
  if (!isEntryType(row.entry_type) || !Number.isInteger(row.amount_minor)) {
    return null;
  }
  if (typeof row.currency !== "string" || typeof row.occurred_at !== "string" || typeof row.is_test !== "boolean") {
    return null;
  }
  return {
    paymentId: row.payment_id,
    orderId: row.order_id,
    entryType: row.entry_type,
    amountMinor: row.amount_minor as number,
    currency: row.currency,
    occurredAt: row.occurred_at,
    isTest: row.is_test,
  };
}

function parseLedgerRow(value: unknown): AdminLedgerRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.order_id !== "string" || typeof row.provider !== "string") {
    return null;
  }
  if (!isEntryType(row.entry_type) || !Number.isInteger(row.amount_minor) || typeof row.currency !== "string") {
    return null;
  }
  if (typeof row.provider_ref !== "string" || typeof row.occurred_at !== "string" || typeof row.is_test !== "boolean") {
    return null;
  }
  const orderReference = readEmbedString(row.orders, "order_reference");
  const paymentStatus = readEmbedString(row.payments, "status");
  if (!orderReference || !paymentStatus) {
    return null;
  }
  return {
    id: row.id,
    orderId: row.order_id,
    orderReference,
    provider: row.provider,
    entryType: row.entry_type,
    amountMinor: row.amount_minor as number,
    currency: row.currency,
    paymentStatus,
    providerRef: row.provider_ref,
    occurredAt: row.occurred_at,
    isTest: row.is_test,
  };
}

function readEmbedString(value: unknown, key: string): string {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object" || !(key in row)) {
    return "";
  }
  const field = (row as Record<string, unknown>)[key];
  return typeof field === "string" ? field.trim() : "";
}

function isEntryType(value: unknown): value is LedgerEntryType {
  return (
    value === "charge" ||
    value === "refund" ||
    value === "fee" ||
    value === "settlement" ||
    value === "adjustment"
  );
}

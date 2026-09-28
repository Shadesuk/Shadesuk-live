import "server-only";

import { COMMITTED_PURCHASE_PAYMENT_STATUSES } from "@/contracts/order/lifecycle";
import {
  ADMIN_CUSTOMER_ORDERS_PAGE_SIZE,
  ADMIN_CUSTOMERS_PAGE_SIZE,
  adminCustomerDisplayName,
  adminCustomerSearchReference,
  guestCustomerId,
  mapSavedAddress,
  parseAdminCustomerId,
  summariseOrderItems,
  type AdminCustomerDetailView,
  type AdminCustomerListItem,
  type AdminCustomerListQuery,
  type AdminCustomerOrderHistoryItem,
  type AdminCustomerSavedAddress,
} from "@/contracts/admin/customers";
import {
  isOrderStatus,
  isPaymentStatus,
} from "@/contracts/admin/dashboard";
import { mapAdminDelivery } from "@/contracts/admin/orders";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DIRECTORY_COLUMNS =
  "id, account_type, user_id, email, first_name, last_name, created_at, order_count, total_spent_minor, last_order_at";
const PROFILE_COLUMNS = "id, email, first_name, last_name, created_at";
const ORDER_HISTORY_COLUMNS =
  "id, order_reference, user_id, customer_email, customer_first_name, customer_last_name, status, payment_status, total_minor, delivery_address, created_at";
const ORDER_ITEM_COLUMNS = "order_id, product_name, quantity, created_at";
const ADDRESS_COLUMNS =
  "id, label, first_name, last_name, address_line_1, address_line_2, city, county, postcode, country, is_default";

export type AdminCustomersLoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "error" }
  | { status: "not_found" };

export type AdminCustomerListResult = {
  customers: AdminCustomerListItem[];
  total: number;
  page: number;
  pageCount: number;
};

export type AdminCustomerInsights = {
  registeredCount: number;
  guestCount: number;
  withOrdersCount: number;
};

export async function loadAdminCustomerList(
  query: AdminCustomerListQuery,
): Promise<AdminCustomersLoadResult<AdminCustomerListResult>> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const from = (query.page - 1) * ADMIN_CUSTOMERS_PAGE_SIZE;
    const to = from + ADMIN_CUSTOMERS_PAGE_SIZE - 1;
    let request = supabase
      .from("admin_customer_directory")
      .select(DIRECTORY_COLUMNS, { count: "exact" })
      .order("last_order_at", { ascending: false, nullsFirst: false })
      .order("email", { ascending: true })
      .range(from, to);
    if (query.accountType !== "all") {
      request = request.eq("account_type", query.accountType);
    }
    if (query.orders === "has_orders") {
      request = request.gt("order_count", 0);
    }
    if (query.orders === "no_orders") {
      request = request.eq("order_count", 0);
    }
    if (query.q) {
      const reference = adminCustomerSearchReference(query.q);
      if (reference) {
        const matchedId = await findCustomerIdForOrderReference(supabase, reference);
        if (!matchedId) {
          return {
            status: "ok",
            data: { customers: [], total: 0, page: query.page, pageCount: 1 },
          };
        }
        request = request.eq("id", matchedId);
      } else {
        const pattern = `%${query.q}%`;
        request = request.or(
          [
            `email.ilike."${pattern}"`,
            `first_name.ilike."${pattern}"`,
            `last_name.ilike."${pattern}"`,
          ].join(","),
        );
      }
    }
    const { data, error, count } = await request;
    if (error) {
      return { status: "error" };
    }
    const total = typeof count === "number" ? count : 0;
    const pageCount = Math.max(1, Math.ceil(total / ADMIN_CUSTOMERS_PAGE_SIZE));
    const customers: AdminCustomerListItem[] = [];
    for (const row of Array.isArray(data) ? data : []) {
      const parsed = parseDirectoryItem(row);
      if (parsed) {
        customers.push(parsed);
      }
    }
    return {
      status: "ok",
      data: {
        customers,
        total,
        page: query.page,
        pageCount,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export async function loadAdminCustomerDetail(
  id: string,
  ordersPage = 1,
): Promise<AdminCustomersLoadResult<AdminCustomerDetailView>> {
  const parsedId = parseAdminCustomerId(id);
  if (!parsedId) {
    return { status: "not_found" };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    if (parsedId.kind === "guest") {
      const profile = await loadProfileByEmail(supabase, parsedId.email);
      if (profile?.id) {
        return loadRegisteredCustomer(supabase, profile.id, ordersPage);
      }
      return loadGuestCustomer(supabase, parsedId.email, ordersPage);
    }
    return loadRegisteredCustomer(supabase, parsedId.userId, ordersPage);
  } catch {
    return { status: "error" };
  }
}

export async function loadAdminCustomerInsights(): Promise<
  AdminCustomersLoadResult<AdminCustomerInsights>
> {
  if (!isSupabaseConfigured()) {
    return { status: "error" };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const [registered, guest, withOrders] = await Promise.all([
      countDirectory(supabase, { column: "account_type", value: "registered" }),
      countDirectory(supabase, { column: "account_type", value: "guest" }),
      countDirectory(supabase, { column: "order_count", operator: "gt", value: 0 }),
    ]);
    if (registered === null || guest === null || withOrders === null) {
      return { status: "error" };
    }
    return {
      status: "ok",
      data: {
        registeredCount: registered,
        guestCount: guest,
        withOrdersCount: withOrders,
      },
    };
  } catch {
    return { status: "error" };
  }
}

type AdminQueryClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function loadRegisteredCustomer(
  supabase: AdminQueryClient,
  userId: string,
  ordersPage: number,
): Promise<AdminCustomersLoadResult<AdminCustomerDetailView>> {
  const [directoryResult, profileResult] = await Promise.all([
    supabase.from("admin_customer_directory").select(DIRECTORY_COLUMNS).eq("id", userId).maybeSingle(),
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
  ]);
  if (directoryResult.error || profileResult.error) {
    return { status: "error" };
  }
  if (!profileResult.data) {
    return { status: "not_found" };
  }
  const profile = parseProfile(profileResult.data);
  if (!profile) {
    return { status: "error" };
  }
  const directory = parseDirectoryItem(directoryResult.data) ?? {
    id: userId,
    accountType: "registered" as const,
    name: adminCustomerDisplayName(profile.firstName, profile.lastName, profile.email),
    email: profile.email,
    orderCount: 0,
    totalSpentMinor: 0,
    lastOrderAt: null,
  };
  const [history, addresses] = await Promise.all([
    loadOrderHistory(supabase, {
      userId,
      email: profile.email,
      page: ordersPage,
    }),
    loadSavedAddresses(supabase, userId),
  ]);
  if (history === null || addresses === null) {
    return { status: "error" };
  }
  return {
    status: "ok",
    data: {
      id: userId,
      accountType: "registered",
      name: directory.name,
      email: profile.email,
      orderCount: directory.orderCount,
      totalSpentMinor: directory.totalSpentMinor,
      lastOrderAt: directory.lastOrderAt,
      lastDelivery: history.lastDelivery,
      savedAddresses: addresses,
      orders: history.orders,
      ordersTotal: history.total,
      ordersPage: history.page,
      ordersPageCount: history.pageCount,
    },
  };
}

async function loadGuestCustomer(
  supabase: AdminQueryClient,
  email: string,
  ordersPage: number,
): Promise<AdminCustomersLoadResult<AdminCustomerDetailView>> {
  const directoryResult = await supabase
    .from("admin_customer_directory")
    .select(DIRECTORY_COLUMNS)
    .eq("id", guestCustomerId(email))
    .maybeSingle();
  if (directoryResult.error) {
    return { status: "error" };
  }
  const history = await loadOrderHistory(supabase, {
    userId: null,
    email,
    page: ordersPage,
  });
  if (history === null) {
    return { status: "error" };
  }
  if (history.total === 0 && !directoryResult.data) {
    return { status: "not_found" };
  }
  const directory = parseDirectoryItem(directoryResult.data);
  const firstOrder = history.orders[0];
  return {
    status: "ok",
    data: {
      id: guestCustomerId(email),
      accountType: "guest",
      name: directory?.name || email,
      email,
      orderCount: directory?.orderCount ?? history.total,
      totalSpentMinor: directory?.totalSpentMinor ?? 0,
      lastOrderAt: directory?.lastOrderAt ?? firstOrder?.createdAt ?? null,
      lastDelivery: history.lastDelivery,
      savedAddresses: [],
      orders: history.orders,
      ordersTotal: history.total,
      ordersPage: history.page,
      ordersPageCount: history.pageCount,
    },
  };
}

async function loadOrderHistory(
  supabase: AdminQueryClient,
  input: { userId: string | null; email: string; page: number },
): Promise<{
  orders: AdminCustomerOrderHistoryItem[];
  total: number;
  page: number;
  pageCount: number;
  lastDelivery: ReturnType<typeof mapAdminDelivery>;
} | null> {
  const from = (input.page - 1) * ADMIN_CUSTOMER_ORDERS_PAGE_SIZE;
  const to = from + ADMIN_CUSTOMER_ORDERS_PAGE_SIZE - 1;
  let request = supabase
    .from("orders")
    .select(ORDER_HISTORY_COLUMNS, { count: "exact" })
    .in("payment_status", [...COMMITTED_PURCHASE_PAYMENT_STATUSES])
    .order("created_at", { ascending: false })
    .range(from, to);
  const email = escapeIlikeExact(input.email);
  if (input.userId) {
    request = request.or(
      `user_id.eq.${input.userId},and(user_id.is.null,customer_email.ilike."${email}")`,
    );
  } else {
    request = request.is("user_id", null).ilike("customer_email", email);
  }
  const { data, error, count } = await request;
  if (error) {
    return null;
  }
  const rows = Array.isArray(data) ? data : [];
  const parsedRows: Array<{
    order: AdminCustomerOrderHistoryItem;
    delivery: ReturnType<typeof mapAdminDelivery>;
  }> = [];
  for (const row of rows) {
    const parsed = parseHistoryOrder(row);
    if (parsed) {
      parsedRows.push(parsed);
    }
  }
  const summaries = await loadOrderSummaries(
    supabase,
    parsedRows.map((row) => row.order.id),
  );
  if (summaries === null) {
    return null;
  }
  const total = typeof count === "number" ? count : 0;
  return {
    orders: parsedRows.map((row) => ({
      ...row.order,
      summary: summaries.get(row.order.id) ?? null,
    })),
    total,
    page: input.page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_CUSTOMER_ORDERS_PAGE_SIZE)),
    lastDelivery: parsedRows[0]?.delivery ?? null,
  };
}

async function loadOrderSummaries(
  supabase: AdminQueryClient,
  orderIds: string[],
): Promise<Map<string, ReturnType<typeof summariseOrderItems>> | null> {
  const summaries = new Map<string, ReturnType<typeof summariseOrderItems>>();
  if (orderIds.length === 0) {
    return summaries;
  }
  const { data, error } = await supabase
    .from("order_items")
    .select(ORDER_ITEM_COLUMNS)
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });
  if (error) {
    return null;
  }
  const grouped = new Map<string, Array<{ productName: string; quantity: number }>>();
  for (const row of Array.isArray(data) ? data : []) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const record = row as Record<string, unknown>;
    if (typeof record.order_id !== "string" || typeof record.product_name !== "string") {
      continue;
    }
    if (!Number.isInteger(record.quantity) || (record.quantity as number) <= 0) {
      continue;
    }
    const list = grouped.get(record.order_id) ?? [];
    list.push({
      productName: record.product_name,
      quantity: record.quantity as number,
    });
    grouped.set(record.order_id, list);
  }
  for (const [orderId, items] of grouped) {
    summaries.set(orderId, summariseOrderItems(items));
  }
  return summaries;
}

async function loadSavedAddresses(
  supabase: AdminQueryClient,
  userId: string,
): Promise<AdminCustomerSavedAddress[] | null> {
  const { data, error } = await supabase
    .from("addresses")
    .select(ADDRESS_COLUMNS)
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) {
    return null;
  }
  const addresses: AdminCustomerSavedAddress[] = [];
  for (const row of Array.isArray(data) ? data : []) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const parsed = mapSavedAddress(row as Record<string, unknown>);
    if (parsed) {
      addresses.push(parsed);
    }
  }
  return addresses;
}

async function loadProfileByEmail(
  supabase: AdminQueryClient,
  email: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", escapeIlikeExact(email))
    .maybeSingle();
  if (error || !data || typeof data !== "object" || typeof (data as { id?: unknown }).id !== "string") {
    return null;
  }
  return { id: (data as { id: string }).id };
}

async function findCustomerIdForOrderReference(
  supabase: AdminQueryClient,
  reference: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("user_id, customer_email")
    .eq("order_reference", reference)
    .maybeSingle();
  if (error || !data || typeof data !== "object") {
    return null;
  }
  const row = data as { user_id: unknown; customer_email: unknown };
  if (typeof row.user_id === "string" && row.user_id.length > 0) {
    return row.user_id;
  }
  if (typeof row.customer_email !== "string" || !row.customer_email.trim()) {
    return null;
  }
  const profile = await loadProfileByEmail(supabase, row.customer_email);
  if (profile?.id) {
    return profile.id;
  }
  return guestCustomerId(row.customer_email);
}

async function countDirectory(
  supabase: AdminQueryClient,
  filter:
    | { column: "account_type"; value: "registered" | "guest" }
    | { column: "order_count"; operator: "gt"; value: number },
): Promise<number | null> {
  let request = supabase.from("admin_customer_directory").select("id", {
    count: "exact",
    head: true,
  });
  if (filter.column === "account_type") {
    request = request.eq("account_type", filter.value);
  } else {
    request = request.gt("order_count", filter.value);
  }
  const { count, error } = await request;
  if (error || typeof count !== "number") {
    return null;
  }
  return count;
}

function parseDirectoryItem(value: unknown): AdminCustomerListItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.email !== "string") {
    return null;
  }
  if (row.account_type !== "registered" && row.account_type !== "guest") {
    return null;
  }
  const orderCount = asNonNegativeInteger(row.order_count);
  const totalSpentMinor = asNonNegativeInteger(row.total_spent_minor);
  if (orderCount === null || totalSpentMinor === null) {
    return null;
  }
  const first = typeof row.first_name === "string" ? row.first_name : "";
  const last = typeof row.last_name === "string" ? row.last_name : "";
  const lastOrderAt =
    typeof row.last_order_at === "string" && !Number.isNaN(new Date(row.last_order_at).getTime())
      ? row.last_order_at
      : null;
  return {
    id: row.id,
    accountType: row.account_type,
    name: adminCustomerDisplayName(first, last, row.email),
    email: row.email,
    orderCount,
    totalSpentMinor,
    lastOrderAt,
  };
}

function parseProfile(value: unknown): { id: string; email: string; firstName: string; lastName: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.email !== "string") {
    return null;
  }
  return {
    id: row.id,
    email: row.email.trim(),
    firstName: typeof row.first_name === "string" ? row.first_name : "",
    lastName: typeof row.last_name === "string" ? row.last_name : "",
  };
}

function parseHistoryOrder(value: unknown): {
  order: AdminCustomerOrderHistoryItem;
  delivery: ReturnType<typeof mapAdminDelivery>;
} | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.order_reference !== "string") {
    return null;
  }
  if (typeof row.created_at !== "string" || Number.isNaN(new Date(row.created_at).getTime())) {
    return null;
  }
  if (!isOrderStatus(row.status) || !isPaymentStatus(row.payment_status)) {
    return null;
  }
  if (!Number.isInteger(row.total_minor) || (row.total_minor as number) < 0) {
    return null;
  }
  const address =
    row.delivery_address && typeof row.delivery_address === "object"
      ? (row.delivery_address as Record<string, unknown>)
      : null;
  return {
    order: {
      id: row.id,
      orderReference: row.order_reference.trim(),
      createdAt: row.created_at,
      orderStatus: row.status,
      paymentStatus: row.payment_status,
      totalMinor: row.total_minor as number,
      summary: null,
    },
    delivery: mapAdminDelivery(address),
  };
}

function escapeIlikeExact(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/["(),]/g, "")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function asNonNegativeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

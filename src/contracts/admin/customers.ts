import { adminOrderSearchReference } from "./orders";
import { isQualifyingRevenuePayment } from "./dashboard";
import { toGuestDeliveryAddress, type GuestDeliveryAddressView } from "../order/dto";
import type { OrderStatus, PaymentStatus } from "../order/schema";
import { isUuid } from "@/lib/ids";

export const ADMIN_CUSTOMERS_PAGE_SIZE = 20;
export const ADMIN_CUSTOMER_ORDERS_PAGE_SIZE = 20;
export const ADMIN_CUSTOMER_SEARCH_MAX = 80;
export const GUEST_CUSTOMER_ID_PREFIX = "guest:";

export const ADMIN_CUSTOMER_ACCOUNT_TYPES = ["all", "registered", "guest"] as const;
export type AdminCustomerAccountTypeFilter = (typeof ADMIN_CUSTOMER_ACCOUNT_TYPES)[number];
export type AdminCustomerAccountType = Exclude<AdminCustomerAccountTypeFilter, "all">;

export const ADMIN_CUSTOMER_ORDER_FILTERS = ["all", "has_orders", "no_orders"] as const;
export type AdminCustomerOrderFilter = (typeof ADMIN_CUSTOMER_ORDER_FILTERS)[number];

export type AdminCustomerListQuery = {
  q: string;
  accountType: AdminCustomerAccountTypeFilter;
  orders: AdminCustomerOrderFilter;
  page: number;
};

export type AdminCustomerListItem = {
  id: string;
  accountType: AdminCustomerAccountType;
  name: string;
  email: string;
  orderCount: number;
  totalSpentMinor: number;
  lastOrderAt: string | null;
};

export type AdminCustomerOrderItemSummary = {
  productName: string;
  quantity: number;
  extraCount: number;
};

export type AdminCustomerOrderHistoryItem = {
  id: string;
  orderReference: string;
  createdAt: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  totalMinor: number;
  summary: AdminCustomerOrderItemSummary | null;
};

export type AdminCustomerSavedAddress = {
  id: string;
  label: string | null;
  isDefault: boolean;
  delivery: GuestDeliveryAddressView;
};

export type AdminCustomerDetailView = {
  id: string;
  accountType: AdminCustomerAccountType;
  name: string;
  email: string;
  orderCount: number;
  totalSpentMinor: number;
  lastOrderAt: string | null;
  lastDelivery: GuestDeliveryAddressView | null;
  savedAddresses: AdminCustomerSavedAddress[];
  orders: AdminCustomerOrderHistoryItem[];
  ordersTotal: number;
  ordersPage: number;
  ordersPageCount: number;
};

export type ParsedAdminCustomerId =
  | { kind: "registered"; userId: string }
  | { kind: "guest"; email: string };

export function parseAdminCustomerListQuery(
  params: Record<string, string | string[] | undefined>,
): AdminCustomerListQuery {
  const q = sanitizeAdminCustomerSearch(readParam(params.q));
  const accountTypeRaw = readParam(params.type);
  const ordersRaw = readParam(params.orders);
  const pageRaw = Number.parseInt(readParam(params.page) || "1", 10);
  return {
    q,
    accountType: isAdminCustomerAccountTypeFilter(accountTypeRaw) ? accountTypeRaw : "all",
    orders: isAdminCustomerOrderFilter(ordersRaw) ? ordersRaw : "all",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function adminCustomerListQueryString(
  query: AdminCustomerListQuery,
  page = query.page,
): string {
  const params = new URLSearchParams();
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.accountType !== "all") {
    params.set("type", query.accountType);
  }
  if (query.orders !== "all") {
    params.set("orders", query.orders);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function parseAdminCustomerOrdersPage(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(typeof raw === "string" ? raw : "1", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function sanitizeAdminCustomerSearch(value: string): string {
  return value
    .trim()
    .slice(0, ADMIN_CUSTOMER_SEARCH_MAX)
    .replace(/["\\,()%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function adminCustomerSearchReference(value: string): string | null {
  return adminOrderSearchReference(value);
}

export function normalizeCustomerEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function guestCustomerId(email: string): string {
  return `${GUEST_CUSTOMER_ID_PREFIX}${normalizeCustomerEmail(email)}`;
}

export function parseAdminCustomerId(value: string | null | undefined): ParsedAdminCustomerId | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const id = value.trim();
  if (isUuid(id)) {
    return { kind: "registered", userId: id };
  }
  if (!id.startsWith(GUEST_CUSTOMER_ID_PREFIX)) {
    return null;
  }
  const email = normalizeCustomerEmail(id.slice(GUEST_CUSTOMER_ID_PREFIX.length));
  if (!email.includes("@") || email.length < 3) {
    return null;
  }
  return { kind: "guest", email };
}

export function isAdminCustomerAccountTypeFilter(
  value: string | null | undefined,
): value is AdminCustomerAccountTypeFilter {
  return value === "all" || value === "registered" || value === "guest";
}

export function isAdminCustomerOrderFilter(
  value: string | null | undefined,
): value is AdminCustomerOrderFilter {
  return value === "all" || value === "has_orders" || value === "no_orders";
}

export function adminCustomerDisplayName(firstName: string, lastName: string, email: string): string {
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  return name || email.trim() || "—";
}

export function capturedSpendMinor(paymentStatus: PaymentStatus | string, totalMinor: number): number {
  if (!isQualifyingRevenuePayment(paymentStatus)) {
    return 0;
  }
  if (!Number.isInteger(totalMinor) || totalMinor < 0) {
    return 0;
  }
  return totalMinor;
}

export function summariseOrderItems(
  items: readonly { productName: string; quantity: number }[],
): AdminCustomerOrderItemSummary | null {
  const first = items[0];
  if (!first || !first.productName.trim() || !Number.isInteger(first.quantity) || first.quantity <= 0) {
    return null;
  }
  return {
    productName: first.productName.trim(),
    quantity: first.quantity,
    extraCount: Math.max(0, items.length - 1),
  };
}

export function formatOrderItemSummary(summary: AdminCustomerOrderItemSummary | null): string {
  if (!summary) {
    return "—";
  }
  const qty = summary.quantity > 1 ? ` × ${summary.quantity}` : "";
  if (summary.extraCount > 0) {
    return `${summary.productName}${qty} · +${summary.extraCount}`;
  }
  return `${summary.productName}${qty}`;
}

export function mapSavedAddress(row: Record<string, unknown>): AdminCustomerSavedAddress | null {
  if (typeof row.id !== "string" || row.id.length === 0) {
    return null;
  }
  const delivery = toGuestDeliveryAddress({
    first_name: row.first_name,
    last_name: row.last_name,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    city: row.city,
    county: row.county,
    postcode: row.postcode,
    country: row.country,
  });
  if (!delivery) {
    return null;
  }
  return {
    id: row.id,
    label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : null,
    isDefault: row.is_default === true,
    delivery,
  };
}

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }
  return typeof value === "string" ? value : "";
}

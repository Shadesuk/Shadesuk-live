/**
 * Provider-agnostic storefront analytics.
 * No GA / GTM / pixel IDs are invented here. Events no-op until a provider is registered.
 */

import { hasAnalyticsConsent } from "@/lib/cookie-consent";

export const ANALYTICS_EVENTS = [
  "page_view",
  "view_item",
  "select_item",
  "select_colour",
  "select_size",
  "open_size_face_guide",
  "search",
  "search_open",
  "search_started",
  "search_query",
  "search_suggestion_view",
  "search_suggestion_click",
  "search_result_view",
  "search_result_click",
  "search_no_results",
  "search_filter_used",
  "search_sort_used",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "address_autocomplete_used",
  "address_manual_entry",
  "add_payment_info",
  "purchase",
  "track_order",
  "filter_used",
  "sort_used",
  "recommendation_click",
  "recently_viewed_click",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsPayload = Record<string, AnalyticsValue | undefined>;

export type AnalyticsProvider = {
  track: (name: AnalyticsEventName, payload?: AnalyticsPayload) => boolean | void;
};

const ALLOWED_KEYS = new Set([
  "path",
  "title",
  "item_id",
  "item_name",
  "item_brand",
  "item_variant",
  "item_category",
  "price",
  "currency",
  "quantity",
  "value",
  "query",
  "result_count",
  "suggestion_type",
  "collection",
  "filter",
  "sort",
  "list",
  "availability",
  "colour_id",
  "size",
  "status",
  "count",
  "content_ids",
  "num_items",
  "contents",
]);

export const PURCHASE_SENT_STORAGE_PREFIX = "shadesuk.purchase.sent.";

export function purchaseSentStorageKey(orderReference: string): string {
  return `${PURCHASE_SENT_STORAGE_PREFIX}${orderReference.trim()}`;
}

const BLOCKED_KEY =
  /email|password|token|secret|phone|address|postcode|name_first|first_name|last_name|full_name/i;

let provider: AnalyticsProvider | null = null;
const reportedPurchases = new Set<string>();

export function registerAnalyticsProvider(next: AnalyticsProvider | null): void {
  provider = next;
}

export function getAnalyticsProvider(): AnalyticsProvider | null {
  return provider;
}

export function sanitizeAnalyticsPayload(
  payload?: AnalyticsPayload,
): Record<string, AnalyticsValue> | undefined {
  if (!payload) {
    return undefined;
  }
  const clean: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value == null) {
      continue;
    }
    if (BLOCKED_KEY.test(key) || !ALLOWED_KEYS.has(key)) {
      continue;
    }
    if (typeof value === "string" && value.length > 200) {
      const limit = key === "contents" || key === "content_ids" ? 2000 : 200;
      clean[key] = value.slice(0, limit);
      continue;
    }
    clean[key] = value;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export function track(name: AnalyticsEventName, payload?: AnalyticsPayload): boolean {
  if (!ANALYTICS_EVENTS.includes(name)) {
    return false;
  }
  if (!provider) {
    return false;
  }
  if (typeof window !== "undefined" && !hasAnalyticsConsent()) {
    return false;
  }
  try {
    return provider.track(name, sanitizeAnalyticsPayload(payload)) !== false;
  } catch {
    // Analytics must never break shopping.
    return false;
  }
}

/**
 * Purchase must fire once per confirmed order identity, and only after the
 * provider confirms the event was queued. A failed init must not permanently
 * suppress a later legitimate Purchase.
 */
export function trackPurchaseOnce(
  orderId: string,
  payload?: AnalyticsPayload,
): boolean {
  const id = orderId.trim();
  if (!id) {
    return false;
  }
  if (hasPurchaseBeenSent(id)) {
    return true;
  }
  if (typeof window !== "undefined" && !hasAnalyticsConsent()) {
    return false;
  }
  const queued = track("purchase", { ...payload, item_id: id });
  if (!queued) {
    return false;
  }
  markPurchaseSent(id);
  return true;
}

export function resetPurchaseDedupeForTests(): void {
  reportedPurchases.clear();
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    const keys: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith("shadesuk.purchase.sent.")) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Test cleanup is best-effort.
  }
}

function hasPurchaseBeenSent(id: string): boolean {
  if (reportedPurchases.has(id)) {
    return true;
  }
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  try {
    if (sessionStorage.getItem(purchaseSentStorageKey(id))) {
      reportedPurchases.add(id);
      return true;
    }
  } catch {
    // Private mode: in-memory dedupe still applies.
  }
  return false;
}

function markPurchaseSent(id: string): void {
  reportedPurchases.add(id);
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(purchaseSentStorageKey(id), "1");
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function cartCommercePayload(
  items: Array<{ productId: string; quantity: number; unitPrice?: number }>,
  value: number,
): AnalyticsPayload {
  const contentIds = items.map((item) => item.productId).filter(Boolean);
  const numItems = items.reduce((sum, item) => sum + (item.quantity > 0 ? item.quantity : 0), 0);
  const contents = items
    .filter((item) => item.productId)
    .map((item) => {
      const quantity = item.quantity > 0 ? item.quantity : 1;
      return typeof item.unitPrice === "number"
        ? `${item.productId}:${quantity}:${item.unitPrice}`
        : `${item.productId}:${quantity}`;
    })
    .join("|");
  return {
    currency: "GBP",
    value,
    content_ids: contentIds.join(","),
    num_items: numItems,
    contents,
  };
}

/**
 * Provider-agnostic storefront analytics.
 * No GA / GTM / pixel IDs are invented here. Events no-op until a provider is registered.
 */

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
  track: (name: AnalyticsEventName, payload?: AnalyticsPayload) => void;
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
]);

import { hasAnalyticsConsent } from "@/lib/cookie-consent";

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
      clean[key] = value.slice(0, 200);
      continue;
    }
    clean[key] = value;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export function track(name: AnalyticsEventName, payload?: AnalyticsPayload): void {
  if (!ANALYTICS_EVENTS.includes(name)) {
    return;
  }
  if (!provider) {
    return;
  }
  if (typeof window !== "undefined" && !hasAnalyticsConsent()) {
    return;
  }
  try {
    provider.track(name, sanitizeAnalyticsPayload(payload));
  } catch {
    // Analytics must never break shopping.
  }
}

/**
 * Purchase must fire once per confirmed order identity.
 * Call only after backend-verified payment — not on confirmation refresh.
 */
export function trackPurchaseOnce(
  orderId: string,
  payload?: AnalyticsPayload,
): void {
  const id = orderId.trim();
  if (!id || reportedPurchases.has(id)) {
    return;
  }
  if (typeof window !== "undefined" && !hasAnalyticsConsent()) {
    return;
  }
  reportedPurchases.add(id);
  track("purchase", { ...payload, item_id: id });
}

export function resetPurchaseDedupeForTests(): void {
  reportedPurchases.clear();
}

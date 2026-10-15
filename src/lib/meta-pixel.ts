/**
 * Central Meta Pixel loader and event dispatcher.
 *
 * The Pixel ID is read only from NEXT_PUBLIC_META_PIXEL_ID. Advertising events
 * stay off until cookie consent allows them. Failures never throw.
 */

import type { AnalyticsEventName, AnalyticsPayload, AnalyticsProvider } from "@/lib/analytics";
import { hasAdvertisingConsent } from "@/lib/cookie-consent";
import {
  META_PIXEL_SCRIPT_ATTR,
  META_PIXEL_SCRIPT_SRC,
} from "@/lib/meta-pixel-hosts";

export const META_PIXEL_READY_EVENT = "shadesuk:meta-pixel-ready";
export const META_CURRENCY = "GBP";

export type MetaStandardEvent =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "Search"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase";

export type MetaPixelCall = {
  args: unknown[];
};

type FacebookPixelFn = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: FacebookPixelFn;
};

type MetaPixelOptions = {
  pixelId?: string;
  loadScript?: (src: string) => Promise<boolean>;
  now?: () => number;
  recentWindowMs?: number;
};

declare global {
  interface Window {
    fbq?: FacebookPixelFn;
    _fbq?: FacebookPixelFn;
  }
}

const PAGE_VIEW_DEDUPE_MS = 1500;
const RECENT_EVENT_DEDUPE_MS = 800;
const PURCHASE_REQUIRES_INIT = true;

let configuredPixelId: string | null = null;
let loadScriptOverride: MetaPixelOptions["loadScript"] | null = null;
let nowFn: () => number = () => Date.now();
let recentWindowMs = RECENT_EVENT_DEDUPE_MS;

let scriptPromise: Promise<boolean> | null = null;
let initialized = false;
let trackingEnabled = false;
let lastPageViewPath = "";
let lastPageViewAt = 0;
const recentEvents = new Map<string, number>();
const queuedCalls: MetaPixelCall[] = [];

export function readMetaPixelId(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (configuredPixelId != null) {
    return configuredPixelId;
  }
  return env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
}

export function configureMetaPixelForTests(options: MetaPixelOptions): void {
  configuredPixelId = options.pixelId ?? configuredPixelId;
  loadScriptOverride = options.loadScript ?? loadScriptOverride;
  nowFn = options.now ?? nowFn;
  recentWindowMs = options.recentWindowMs ?? recentWindowMs;
}

export function resetMetaPixelForTests(): void {
  configuredPixelId = null;
  loadScriptOverride = null;
  nowFn = () => Date.now();
  recentWindowMs = RECENT_EVENT_DEDUPE_MS;
  scriptPromise = null;
  initialized = false;
  trackingEnabled = false;
  lastPageViewPath = "";
  lastPageViewAt = 0;
  recentEvents.clear();
  queuedCalls.length = 0;
  if (typeof window !== "undefined") {
    delete window.fbq;
    delete window._fbq;
  }
}

export function isMetaPixelInitialized(): boolean {
  return initialized;
}

export function isMetaPixelTrackingEnabled(): boolean {
  return trackingEnabled && initialized;
}

export function getMetaPixelCallsForTests(): MetaPixelCall[] {
  return queuedCalls.slice();
}

export function purchaseEventId(orderReference: string): string {
  return `shu_purchase_${orderReference.trim()}`;
}

export function subscribeMetaPixelReady(onReady: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener(META_PIXEL_READY_EVENT, onReady);
  return () => window.removeEventListener(META_PIXEL_READY_EVENT, onReady);
}

export function catalogueContentIds(ids: Array<string | null | undefined>): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

export function encodeMetaContents(
  items: Array<{ id: string; quantity: number; item_price?: number }>,
): string {
  return items
    .map((item) => {
      const id = item.id.trim();
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
      if (typeof item.item_price === "number" && Number.isFinite(item.item_price)) {
        return `${id}:${quantity}:${item.item_price}`;
      }
      return `${id}:${quantity}`;
    })
    .filter((row) => row.startsWith(":") === false && row.length > 2)
    .join("|");
}

export function parseMetaContents(
  value: string | undefined,
): Array<{ id: string; quantity: number; item_price?: number }> {
  if (!value) {
    return [];
  }
  const rows: Array<{ id: string; quantity: number; item_price?: number }> = [];
  for (const part of value.split("|")) {
    const [id, quantityRaw, priceRaw] = part.split(":");
    const trimmed = id?.trim() ?? "";
    if (!trimmed) {
      continue;
    }
    const quantity = Number(quantityRaw);
    const item: { id: string; quantity: number; item_price?: number } = {
      id: trimmed,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    };
    const price = Number(priceRaw);
    if (Number.isFinite(price)) {
      item.item_price = price;
    }
    rows.push(item);
  }
  return rows;
}

export async function enableMetaPixel(): Promise<boolean> {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    if (!hasAdvertisingConsent()) {
      trackingEnabled = false;
      return false;
    }
    const pixelId = readMetaPixelId();
    if (!pixelId) {
      return false;
    }
    if (initialized) {
      grantConsent();
      trackingEnabled = true;
      notifyReady();
      return true;
    }
    ensureFbqStub();
    grantConsent();
    const loaded = await loadPixelScript();
    if (!loaded) {
      initialized = false;
      trackingEnabled = false;
      return false;
    }
    callFbq("init", pixelId);
    callFbq("set", "autoConfig", false, pixelId);
    initialized = true;
    trackingEnabled = true;
    notifyReady();
    return true;
  } catch {
    initialized = false;
    trackingEnabled = false;
    return false;
  }
}

export function disableMetaPixelTracking(): void {
  trackingEnabled = false;
  lastPageViewPath = "";
  lastPageViewAt = 0;
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      callFbq("consent", "revoke");
    }
  } catch {
    // Withdrawal must never throw.
  }
}

export function dispatchMetaEvent(
  event: MetaStandardEvent,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
): boolean {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    if (!trackingEnabled || !hasAdvertisingConsent()) {
      return false;
    }
    if (event === "Purchase" && PURCHASE_REQUIRES_INIT && !initialized) {
      return false;
    }
    if (typeof window.fbq !== "function") {
      return false;
    }
    if (event === "PageView") {
      const path = typeof params?.path === "string" ? params.path : currentPath();
      if (shouldSkipPageView(path)) {
        return true;
      }
      lastPageViewPath = path;
      lastPageViewAt = nowFn();
      callFbq("track", "PageView");
      recordCall(["track", "PageView"]);
      return true;
    }
    const key = `${event}:${stableSerialize(params)}:${options?.eventID ?? ""}`;
    if (isRecentDuplicate(key)) {
      return true;
    }
    if (options?.eventID) {
      callFbq("track", event, params ?? {}, { eventID: options.eventID });
      recordCall(["track", event, params ?? {}, { eventID: options.eventID }]);
    } else {
      callFbq("track", event, params ?? {});
      recordCall(["track", event, params ?? {}]);
    }
    recentEvents.set(key, nowFn());
    return true;
  } catch {
    return false;
  }
}

export function trackMetaFromAnalytics(
  name: AnalyticsEventName,
  payload?: AnalyticsPayload,
): boolean {
  const mapped = mapAnalyticsEventToMeta(name, payload);
  if (!mapped) {
    return true;
  }
  return dispatchMetaEvent(mapped.event, mapped.params, mapped.options);
}

export const metaPixelAnalyticsProvider: AnalyticsProvider = {
  track(name, payload) {
    return trackMetaFromAnalytics(name, payload);
  },
};

export function mapAnalyticsEventToMeta(
  name: AnalyticsEventName,
  payload?: AnalyticsPayload,
): { event: MetaStandardEvent; params: Record<string, unknown>; options?: { eventID?: string } } | null {
  const contentIds = resolveContentIds(payload);
  const quantity = numeric(payload?.quantity) ?? 1;
  const unitPrice = numeric(payload?.price);
  const value = monetaryValue(payload, quantity, unitPrice);
  const currency = META_CURRENCY;
  const contents = resolveContents(payload, contentIds, quantity, unitPrice);
  const numItems = numeric(payload?.num_items) ?? numeric(payload?.count) ?? (contents.length > 0
    ? contents.reduce((sum, item) => sum + item.quantity, 0)
    : undefined);

  switch (name) {
    case "page_view":
      return {
        event: "PageView",
        params: typeof payload?.path === "string" ? { path: payload.path } : {},
      };
    case "view_item":
      return {
        event: "ViewContent",
        params: compactParams({
          content_ids: contentIds,
          content_type: "product",
          content_name: stringValue(payload?.item_name),
          value,
          currency,
        }),
      };
    case "add_to_cart":
      return {
        event: "AddToCart",
        params: compactParams({
          content_ids: contentIds,
          content_type: "product",
          contents,
          value,
          currency,
          num_items: numItems ?? quantity,
        }),
      };
    case "search":
      return {
        event: "Search",
        params: compactParams({
          search_string: stringValue(payload?.query),
          content_type: "product",
        }),
      };
    case "begin_checkout":
      return {
        event: "InitiateCheckout",
        params: compactParams({
          content_ids: contentIds,
          content_type: contentIds ? "product" : undefined,
          contents: contents.length > 0 ? contents : undefined,
          value,
          currency,
          num_items: numItems,
        }),
      };
    case "add_payment_info":
      return {
        event: "AddPaymentInfo",
        params: compactParams({
          content_ids: contentIds,
          content_type: contentIds ? "product" : undefined,
          contents: contents.length > 0 ? contents : undefined,
          value,
          currency,
          num_items: numItems,
        }),
      };
    case "purchase": {
      const orderReference = stringValue(payload?.item_id);
      const purchaseIds = typeof payload?.content_ids === "string"
        ? catalogueContentIds(payload.content_ids.split(","))
        : [];
      const purchaseContents = typeof payload?.contents === "string"
        ? parseMetaContents(payload.contents)
        : [];
      return {
        event: "Purchase",
        params: compactParams({
          content_ids: purchaseIds.length > 0 ? purchaseIds : undefined,
          content_type: purchaseIds.length > 0 ? "product" : undefined,
          contents: purchaseContents.length > 0 ? purchaseContents : undefined,
          value,
          currency,
          num_items: numItems,
        }),
        options: orderReference ? { eventID: purchaseEventId(orderReference) } : undefined,
      };
    }
    default:
      return null;
  }
}

function resolveContentIds(payload?: AnalyticsPayload): string[] | undefined {
  const fromList = typeof payload?.content_ids === "string"
    ? catalogueContentIds(payload.content_ids.split(","))
    : [];
  if (fromList.length > 0) {
    return fromList;
  }
  const single = stringValue(payload?.item_id);
  return single ? [single] : undefined;
}

function resolveContents(
  payload: AnalyticsPayload | undefined,
  contentIds: string[] | undefined,
  quantity: number,
  unitPrice: number | undefined,
): Array<{ id: string; quantity: number; item_price?: number }> {
  const encoded = typeof payload?.contents === "string" ? parseMetaContents(payload.contents) : [];
  if (encoded.length > 0) {
    return encoded;
  }
  if (!contentIds || contentIds.length === 0) {
    return [];
  }
  if (contentIds.length === 1) {
    return [
      compactContent({
        id: contentIds[0],
        quantity,
        item_price: unitPrice,
      }),
    ];
  }
  return contentIds.map((id) => ({ id, quantity: 1 }));
}

function compactContent(item: { id: string; quantity: number; item_price?: number }): {
  id: string;
  quantity: number;
  item_price?: number;
} {
  if (typeof item.item_price === "number") {
    return item;
  }
  return { id: item.id, quantity: item.quantity };
}

function monetaryValue(
  payload: AnalyticsPayload | undefined,
  quantity: number,
  unitPrice: number | undefined,
): number | undefined {
  const explicit = numeric(payload?.value);
  if (explicit != null) {
    return explicit;
  }
  if (unitPrice != null) {
    return roundMoney(unitPrice * quantity);
  }
  return undefined;
}

function numeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function compactParams(params: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function shouldSkipPageView(path: string): boolean {
  if (!path) {
    return false;
  }
  return path === lastPageViewPath && nowFn() - lastPageViewAt < PAGE_VIEW_DEDUPE_MS;
}

function currentPath(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return `${window.location.pathname}${window.location.search}`;
}

function isRecentDuplicate(key: string): boolean {
  const previous = recentEvents.get(key);
  if (previous == null) {
    return false;
  }
  return nowFn() - previous < recentWindowMs;
}

function ensureFbqStub(): void {
  if (typeof window === "undefined" || typeof window.fbq === "function") {
    return;
  }
  const fbq = function fbqStub(...args: unknown[]) {
    if (typeof fbqStub.callMethod === "function") {
      fbqStub.callMethod(...args);
      return;
    }
    fbqStub.queue.push(args);
  } as FacebookPixelFn;
  fbq.queue = [];
  fbq.loaded = false;
  fbq.version = "2.0";
  fbq.push = fbq;
  window.fbq = fbq;
  window._fbq = fbq;
}

function callFbq(...args: unknown[]): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }
  window.fbq(...args);
}

function recordCall(args: unknown[]): void {
  queuedCalls.push({ args });
}

function notifyReady(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(META_PIXEL_READY_EVENT));
}

function grantConsent(): void {
  try {
    callFbq("consent", "grant");
  } catch {
    // Consent grant is best-effort.
  }
}

function loadPixelScript(): Promise<boolean> {
  if (scriptPromise) {
    return scriptPromise;
  }
  const loader = loadScriptOverride ?? loadPixelScriptInBrowser;
  scriptPromise = loader(META_PIXEL_SCRIPT_SRC).then((ok) => {
    if (!ok) {
      scriptPromise = null;
    } else if (typeof window !== "undefined" && window.fbq) {
      window.fbq.loaded = true;
    }
    return ok;
  }).catch(() => {
    scriptPromise = null;
    return false;
  });
  return scriptPromise;
}

function loadPixelScriptInBrowser(src: string): Promise<boolean> {
  if (typeof document === "undefined") {
    return Promise.resolve(false);
  }
  const existing = document.querySelector<HTMLScriptElement>(`script[${META_PIXEL_SCRIPT_ATTR}]`);
  if (existing) {
    if (window.fbq?.loaded) {
      return Promise.resolve(true);
    }
    return waitForScript(existing);
  }
  return new Promise((resolve) => {
    try {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      script.setAttribute(META_PIXEL_SCRIPT_ATTR, "true");
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      const first = document.getElementsByTagName("script")[0];
      if (first?.parentNode) {
        first.parentNode.insertBefore(script, first);
        return;
      }
      if (document.head) {
        document.head.appendChild(script);
        return;
      }
      if (document.body) {
        document.body.appendChild(script);
        return;
      }
      resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function waitForScript(script: HTMLScriptElement): Promise<boolean> {
  return new Promise((resolve) => {
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
  });
}

function stableSerialize(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value !== "object") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries.map(([key, nested]) => `${key}:${stableSerialize(nested)}`).join(",")}}`;
}

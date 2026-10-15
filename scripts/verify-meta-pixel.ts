import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cartCommercePayload,
  registerAnalyticsProvider,
  resetPurchaseDedupeForTests,
  sanitizeAnalyticsPayload,
  track,
  trackPurchaseOnce,
} from "../src/lib/analytics";
import {
  COOKIE_CONSENT_VERSION,
  hasAdvertisingConsent,
  hasAnalyticsConsent,
  writeCookieConsent,
} from "../src/lib/cookie-consent";
import {
  configureMetaPixelForTests,
  disableMetaPixelTracking,
  dispatchMetaEvent,
  enableMetaPixel,
  getMetaPixelCallsForTests,
  isMetaPixelInitialized,
  isMetaPixelTrackingEnabled,
  mapAnalyticsEventToMeta,
  metaPixelAnalyticsProvider,
  purchaseEventId,
  readMetaPixelId,
  resetMetaPixelForTests,
} from "../src/lib/meta-pixel";
import { META_PIXEL_SCRIPT_SRC } from "../src/lib/meta-pixel-hosts";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  readonly length: number;
};

function createMemoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    get length() {
      return map.size;
    },
  };
}

function installBrowser(): {
  storage: MemoryStorage;
  session: MemoryStorage;
} {
  const storage = createMemoryStorage();
  const session = createMemoryStorage();
  const listeners = new Map<string, Set<EventListener>>();
  let cookieJar = "";

  const target = {
    location: { protocol: "https:", pathname: "/", search: "" },
    localStorage: storage,
    sessionStorage: session,
    addEventListener(type: string, listener: EventListener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
  };

  const document = {
    get cookie() {
      return cookieJar;
    },
    set cookie(value: string) {
      const pair = String(value).split(";")[0] ?? "";
      const name = pair.split("=")[0] ?? "";
      const rest = cookieJar
        .split("; ")
        .filter((part) => part && !part.startsWith(`${name}=`));
      cookieJar = [...rest, pair].filter(Boolean).join("; ");
    },
    createElement() {
      return { async: true, src: "", setAttribute() {}, onload: null, onerror: null };
    },
    getElementsByTagName() {
      return [] as unknown as HTMLCollectionOf<HTMLScriptElement>;
    },
    querySelector() {
      return null;
    },
    head: { appendChild() {} },
    body: { appendChild() {} },
  };

  Object.assign(globalThis, {
    window: target,
    document,
    localStorage: storage,
    sessionStorage: session,
    Event,
  });
  (globalThis as { window: typeof target }).window = target as typeof target;
  return { storage, session };
}

function metaTracks(): unknown[][] {
  return getMetaPixelCallsForTests()
    .map((call) => call.args)
    .filter((args) => args[0] === "track");
}

function standardEvents(): string[] {
  return metaTracks().map((args) => String(args[1]));
}

async function withConsentedPixel(): Promise<void> {
  resetMetaPixelForTests();
  resetPurchaseDedupeForTests();
  configureMetaPixelForTests({
    pixelId: "240000000000001",
    loadScript: async () => true,
  });
  writeCookieConsent(true);
  const ready = await enableMetaPixel();
  assert(ready && isMetaPixelInitialized(), "Pixel must initialize after consent and a successful script load.");
  registerAnalyticsProvider(metaPixelAnalyticsProvider);
}

function sourceGuards(): void {
  assert(existsSync(resolve(root, "src/lib/meta-pixel.ts")), "Missing Meta Pixel module.");
  assert(existsSync(resolve(root, "src/components/analytics/MetaPixel.tsx")), "Missing MetaPixel component.");
  assert(COOKIE_CONSENT_VERSION === 2, "Consent version must bump so advertising measurement is not silently applied to a v1 choice.");

  const envExample = read(".env.example");
  assert(envExample.includes("NEXT_PUBLIC_META_PIXEL_ID"), ".env.example must document NEXT_PUBLIC_META_PIXEL_ID.");
  assert(
    !/NEXT_PUBLIC_META_PIXEL_ID=\d{8,}/.test(envExample),
    "Do not commit a Pixel ID in .env.example.",
  );

  const pixelSource = read("src/lib/meta-pixel.ts");
  assert(pixelSource.includes("NEXT_PUBLIC_META_PIXEL_ID"), "Pixel ID must be read from NEXT_PUBLIC_META_PIXEL_ID.");
  assert(
    !/fbq\(\s*["']init["']\s*,\s*["']\d{8,}/.test(pixelSource),
    "Do not hardcode a Pixel ID in fbq init.",
  );
  assert(pixelSource.includes("hasAdvertisingConsent"), "Pixel must check advertising consent.");
  assert(pixelSource.includes('track", "PageView') || pixelSource.includes('"PageView"'), "Pixel must support PageView.");

  const chrome = read("src/components/navigation/SiteChrome.tsx");
  assert(chrome.includes("MetaPixel"), "Storefront chrome must load MetaPixel once.");
  assert(chrome.includes("AnalyticsPageView"), "Route PageViews must stay on AnalyticsPageView.");
  assert((chrome.match(/<MetaPixel/g) ?? []).length === 1, "MetaPixel must be mounted once.");

  const rootLayout = read("src/app/layout.tsx");
  assert(!rootLayout.includes("MetaPixel"), "Do not mount a second Pixel in the root layout.");
  assert(!rootLayout.includes("fbevents.js"), "Do not duplicate the Pixel script in the root layout.");

  const consent = read("src/components/consent/CookieConsent.tsx");
  assert(consent.includes("Meta Pixel"), "The existing banner must disclose Meta Pixel.");
  assert(!consent.includes("CookieConsent") || (read("src/app/(storefront)/layout.tsx").includes("SiteChrome")), "Reuse SiteChrome consent.");

  const confirmation = read("src/components/checkout/OrderConfirmation.tsx");
  const unpaidStart = confirmation.indexOf("if (!order)");
  const unpaidEnd = confirmation.indexOf("data-order-confirmation");
  const unpaidBranch = confirmation.slice(unpaidStart, unpaidEnd);
  assert(unpaidStart >= 0 && unpaidEnd > unpaidStart, "Confirmation must keep an unpaid branch.");
  assert(
    !unpaidBranch.includes("<OrderConfirmationPurchase"),
    "Unpaid confirmation must not mount Purchase tracking.",
  );
  assert(confirmation.includes("<OrderConfirmationPurchase"), "Captured confirmation must mount Purchase tracking.");

  for (const path of [
    "src/app/(storefront)/checkout/payment-actions.ts",
    "src/lib/payment/capture-verified.ts",
    "src/lib/payment/after-captured.ts",
    "src/lib/paypal/open-buttons.ts",
    "src/lib/razorpay/commit.ts",
  ]) {
    const source = read(path);
    assert(!source.includes("trackPurchaseOnce"), `${path} must not fire Purchase.`);
    assert(!source.includes('"Purchase"'), `${path} must not fire a Meta Purchase event.`);
    assert(!source.includes("fbq("), `${path} must not call fbq.`);
  }

  const review = read("src/components/checkout/CheckoutReview.tsx");
  assert(review.includes("add_payment_info"), "PayPal payment start must fire add_payment_info.");
  assert(!review.includes("trackPurchaseOnce"), "Checkout review must not fire Purchase.");
  assert(review.includes("verifyCheckoutPaymentAction"), "Review must still verify payment on the server.");

  const india = read("src/components/checkout/IndiaPayment.tsx");
  assert(india.includes("onPaymentStarted"), "India payment start must expose a tracking hook.");
  assert(!india.includes("trackPurchaseOnce"), "India checkout must not fire Purchase.");

  const checkoutPage = read("src/components/checkout/CheckoutPage.tsx");
  assert(checkoutPage.includes("begin_checkout"), "Checkout landing must keep InitiateCheckout via begin_checkout.");

  const pdp = read("src/components/pdp/ProductViewRecorder.tsx");
  assert(pdp.includes('track("view_item"'), "PDP must fire view_item for ViewContent.");
  const hero = read("src/components/pdp/ProductHero.tsx");
  assert(hero.includes('track("add_to_cart"'), "Add to bag success must fire add_to_cart.");
  assert(hero.indexOf("result.status === \"added\"") < hero.indexOf('track("add_to_cart"'), "AddToCart must wait for a successful add.");

  const searchTemplate = read("src/components/discovery/CollectionTemplate.tsx");
  assert(searchTemplate.includes('event="search"'), "Search results must fire the existing search analytics event.");

  const purchase = read("src/components/checkout/OrderConfirmationPurchase.tsx");
  assert(purchase.includes("trackPurchaseOnce"), "Captured confirmation is the Purchase firing point.");
  assert(purchase.includes("subscribeMetaPixelReady"), "Purchase must retry after Pixel init.");
  assert(purchase.includes("subscribeCookieConsent"), "Purchase must retry after consent is granted.");

  const analytics = read("src/lib/analytics.ts");
  assert(analytics.includes("const queued = track(\"purchase\""), "Purchase dedupe must wait for a queued dispatch.");
  assert(analytics.includes("if (!queued)"), "A failed Purchase dispatch must not mark the order sent.");

  const csp = read("src/lib/paypal/csp.ts");
  const hosts = read("src/lib/meta-pixel-hosts.ts");
  assert(csp.includes("META_PIXEL_CSP_SCRIPT"), "CSP must include the Meta Pixel script fragment.");
  assert(hosts.includes("connect.facebook.net"), "Pixel hosts must allow connect.facebook.net.");
  assert(hosts.includes("facebook.com"), "Pixel hosts must allow Facebook connect endpoints.");

  const confirmationPage = read("src/app/(storefront)/checkout/confirmation/page.tsx");
  assert(
    confirmationPage.includes("loadCapturedCheckoutConfirmation"),
    "Confirmation must stay on the captured-order loader.",
  );

  assert(readMetaPixelId({} as NodeJS.ProcessEnv) === "", "An unset Pixel ID must be empty, never invented.");
  assert(
    readMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "  240000000000001  " } as NodeJS.ProcessEnv) === "240000000000001",
    "Pixel ID must trim the env value.",
  );
  assert(META_PIXEL_SCRIPT_SRC === "https://connect.facebook.net/en_US/fbevents.js", "Pixel script URL must stay the official host.");
}

function mappingGuards(): void {
  const view = mapAnalyticsEventToMeta("view_item", {
    item_id: "11111111-1111-1111-1111-111111111111",
    item_name: "Frame Live",
    price: 49,
    currency: "GBP",
  });
  assert(view?.event === "ViewContent", "view_item must map to ViewContent.");
  assert(JSON.stringify(view?.params.content_ids) === JSON.stringify(["11111111-1111-1111-1111-111111111111"]), "ViewContent must use the catalogue product id.");
  assert(view?.params.currency === "GBP" && view?.params.value === 49, "ViewContent must send GBP value.");
  assert(view?.params.content_type === "product", "ViewContent content_type must be product.");

  const add = mapAnalyticsEventToMeta("add_to_cart", {
    item_id: "11111111-1111-1111-1111-111111111111",
    quantity: 2,
    price: 49,
    currency: "GBP",
  });
  assert(add?.event === "AddToCart", "add_to_cart must map to AddToCart.");
  assert(add?.params.value === 98, "AddToCart value must be unit price × quantity.");

  const search = mapAnalyticsEventToMeta("search", { query: "aviator", result_count: 3 });
  assert(search?.event === "Search" && search.params.search_string === "aviator", "search must map to Search with search_string.");

  const checkout = mapAnalyticsEventToMeta(
    "begin_checkout",
    cartCommercePayload(
      [{ productId: "11111111-1111-1111-1111-111111111111", quantity: 1, unitPrice: 49 }],
      53.65,
    ),
  );
  assert(checkout?.event === "InitiateCheckout", "begin_checkout must map to InitiateCheckout.");
  assert(checkout?.params.currency === "GBP" && checkout?.params.value === 53.65, "InitiateCheckout must use GBP totals.");

  const pay = mapAnalyticsEventToMeta("add_payment_info", { value: 53.65, currency: "GBP" });
  assert(pay?.event === "AddPaymentInfo", "add_payment_info must map to AddPaymentInfo.");

  const purchase = mapAnalyticsEventToMeta("purchase", {
    item_id: "4827",
    value: 53.65,
    currency: "GBP",
    content_ids: "11111111-1111-1111-1111-111111111111",
  });
  assert(purchase?.event === "Purchase", "purchase must map to Purchase.");
  assert(purchase?.options?.eventID === purchaseEventId("4827"), "Purchase eventID must derive from the order reference.");
  assert(
    JSON.stringify(purchase?.params.content_ids) === JSON.stringify(["11111111-1111-1111-1111-111111111111"]),
    "Purchase must not treat the order reference as a catalogue id.",
  );

  assert(mapAnalyticsEventToMeta("select_colour") === null, "Non-standard events must not be sent to Meta.");
  assert(mapAnalyticsEventToMeta("view_cart") === null, "view_cart is not a Meta standard event in this integration.");

  const dirty = sanitizeAnalyticsPayload({
    email: "hidden@example.com",
    phone: "07000000000",
    item_id: "p1",
    first_name: "Ada",
  });
  assert(dirty && !("email" in dirty) && !("phone" in dirty) && !("first_name" in dirty) && dirty.item_id === "p1", "Pixel payloads must drop personal data.");
}

async function consentAndInitGuards(): Promise<void> {
  installBrowser();
  resetMetaPixelForTests();
  resetPurchaseDedupeForTests();
  configureMetaPixelForTests({
    pixelId: "240000000000001",
    loadScript: async () => true,
  });

  assert(!hasAnalyticsConsent() && !hasAdvertisingConsent(), "Consent must start unset.");
  assert((await enableMetaPixel()) === false, "Pixel must not initialize before consent.");
  assert(!isMetaPixelInitialized(), "Pixel init flag must stay false without consent.");
  registerAnalyticsProvider(metaPixelAnalyticsProvider);
  track("page_view", { path: "/" });
  track("view_item", { item_id: "p1", price: 49, currency: "GBP" });
  assert(standardEvents().length === 0, "No Meta events may fire before consent.");

  writeCookieConsent(false);
  assert(!hasAdvertisingConsent(), "Reject non-essential must keep advertising off.");
  assert((await enableMetaPixel()) === false, "Rejected consent must not load Pixel.");

  writeCookieConsent(true);
  assert(hasAdvertisingConsent(), "Accept all must enable advertising consent.");
  assert(await enableMetaPixel(), "Pixel must initialize after Accept all.");
  registerAnalyticsProvider(metaPixelAnalyticsProvider);
  track("page_view", { path: "/" });
  assert(standardEvents().filter((name) => name === "PageView").length === 1, "First consented PageView must fire once.");

  disableMetaPixelTracking();
  const before = standardEvents().length;
  track("add_to_cart", { item_id: "p1", quantity: 1, price: 49, currency: "GBP" });
  dispatchMetaEvent("AddToCart", { content_ids: ["p1"], currency: "GBP", value: 49 });
  assert(standardEvents().length === before, "Withdrawn consent must stop further Pixel events.");
  assert(!isMetaPixelTrackingEnabled(), "Tracking enabled flag must clear on withdrawal.");

  writeCookieConsent(true);
  assert(await enableMetaPixel(), "Re-granting consent must re-enable an already loaded Pixel.");
}

async function pageViewAndCommerceGuards(): Promise<void> {
  installBrowser();
  await withConsentedPixel();

  dispatchMetaEvent("PageView", { path: "/product/frame-01" });
  dispatchMetaEvent("PageView", { path: "/product/frame-01" });
  dispatchMetaEvent("PageView", { path: "/search?q=aviator" });
  const pages = standardEvents().filter((name) => name === "PageView");
  assert(pages.length === 2, "Route-change PageViews must not duplicate the same path.");

  resetMetaPixelForTests();
  configureMetaPixelForTests({
    pixelId: "240000000000001",
    loadScript: async () => true,
  });
  writeCookieConsent(true);
  await enableMetaPixel();
  registerAnalyticsProvider(metaPixelAnalyticsProvider);

  track("view_item", {
    item_id: "11111111-1111-1111-1111-111111111111",
    item_name: "Frame Live",
    price: 49,
    currency: "GBP",
  });
  track("add_to_cart", {
    item_id: "11111111-1111-1111-1111-111111111111",
    quantity: 2,
    price: 49,
    currency: "GBP",
  });
  track("search", { query: "aviator", result_count: 4 });
  track(
    "begin_checkout",
    cartCommercePayload(
      [{ productId: "11111111-1111-1111-1111-111111111111", quantity: 2, unitPrice: 49 }],
      102.65,
    ),
  );
  track("add_payment_info", { value: 102.65, currency: "GBP" });

  const names = standardEvents();
  assert(names.includes("ViewContent"), "Product view must queue ViewContent.");
  assert(names.includes("AddToCart"), "Successful add to bag must queue AddToCart.");
  assert(names.includes("Search"), "Search results must queue Search.");
  assert(names.includes("InitiateCheckout"), "Checkout start must queue InitiateCheckout.");
  assert(names.includes("AddPaymentInfo"), "Payment start must queue AddPaymentInfo.");
  assert(!names.includes("Purchase"), "Checkout and cart actions must not queue Purchase.");

  track("view_item", {
    item_id: "11111111-1111-1111-1111-111111111111",
    item_name: "Frame Live",
    price: 49,
    currency: "GBP",
  });
  const views = standardEvents().filter((name) => name === "ViewContent");
  assert(views.length === 1, "Strict-mode rerenders must not duplicate ViewContent.");
}

async function purchaseGuards(): Promise<void> {
  installBrowser();
  resetMetaPixelForTests();
  resetPurchaseDedupeForTests();
  registerAnalyticsProvider(null);

  assert(
    trackPurchaseOnce("4827", { currency: "GBP", value: 53.65, content_ids: "p1" }) === false,
    "Purchase must not be marked sent when no provider is registered.",
  );

  configureMetaPixelForTests({
    pixelId: "240000000000001",
    loadScript: async () => false,
  });
  writeCookieConsent(true);
  assert((await enableMetaPixel()) === false, "Script failure must not initialize the Pixel.");
  registerAnalyticsProvider(metaPixelAnalyticsProvider);
  assert(
    trackPurchaseOnce("4827", { currency: "GBP", value: 53.65, content_ids: "p1" }) === false,
    "Purchase must not be marked sent when Pixel init failed.",
  );
  assert(!sessionStorage.getItem("shadesuk.purchase.sent.4827"), "Failed init must not persist a sent marker.");

  configureMetaPixelForTests({
    pixelId: "240000000000001",
    loadScript: async () => true,
  });
  assert(await enableMetaPixel(), "Retry after a failed load must initialize the Pixel.");
  registerAnalyticsProvider(metaPixelAnalyticsProvider);
  assert(
    trackPurchaseOnce("4827", {
      currency: "GBP",
      value: 53.65,
      content_ids: "11111111-1111-1111-1111-111111111111",
      contents: "11111111-1111-1111-1111-111111111111:1:53.65",
      num_items: 1,
    }) === true,
    "Verified captured-order Purchase must queue after Pixel init.",
  );
  const purchases = metaTracks().filter((args) => args[1] === "Purchase");
  assert(purchases.length === 1, "A verified order must generate one Purchase.");
  assert(
    JSON.stringify(purchases[0]?.[3]) === JSON.stringify({ eventID: purchaseEventId("4827") }),
    "Purchase must send the stable eventID.",
  );

  trackPurchaseOnce("4827", { currency: "GBP", value: 53.65 });
  trackPurchaseOnce("4827", { currency: "GBP", value: 53.65 });
  assert(
    metaTracks().filter((args) => args[1] === "Purchase").length === 1,
    "Duplicate callbacks and confirmation reloads must not send a second Purchase.",
  );
  assert(sessionStorage.getItem("shadesuk.purchase.sent.4827") === "1", "Successful Purchase may persist a sent marker.");

  writeCookieConsent(false);
  disableMetaPixelTracking();
  const count = metaTracks().filter((args) => args[1] === "Purchase").length;
  trackPurchaseOnce("9999", { currency: "GBP", value: 10 });
  assert(
    metaTracks().filter((args) => args[1] === "Purchase").length === count,
    "Withdrawn consent must not send Purchase.",
  );
}

sourceGuards();
mappingGuards();

installBrowser();
void (async () => {
  await consentAndInitGuards();
  await pageViewAndCommerceGuards();
  await purchaseGuards();
  console.log("verify-meta-pixel: ok");
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

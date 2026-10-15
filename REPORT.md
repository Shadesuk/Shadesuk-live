# SHADESUK Meta Pixel integration

Status: **IMPLEMENTED — NOT PRODUCTION-VERIFIED IN META EVENTS MANAGER**

Do not treat this as production verification. The deployed site has not been tested with Meta Events Manager Test Events.

## Files changed and why

### Pixel, consent, and analytics

- `src/lib/meta-pixel-hosts.ts` — official Pixel script URL and CSP hosts. No Pixel ID.
- `src/lib/meta-pixel.ts` — single loader, `fbq` init, consent grant/revoke, event mapping, PageView path dedupe, short-window rerender dedupe. Script loads at most once. Failures never throw.
- `src/components/analytics/MetaPixel.tsx` — storefront bootstrap. Registers the existing analytics provider after consent and a successful script load.
- `src/components/navigation/SiteChrome.tsx` — mounts `MetaPixel` once next to `AnalyticsPageView`. No second banner, no second Pixel.
- `src/lib/analytics.ts` — `track()` returns whether the provider queued the event. `trackPurchaseOnce` marks an order sent only after a successful queue. Catalogue `content_ids` / `contents` / `num_items` are allowed; email, phone, and addresses remain blocked.
- `src/lib/cookie-consent.ts` — still one banner and one analytics boolean. Version bumped to 2 so a stored v1 “analytics on” choice does not silently enable advertising. `hasAdvertisingConsent()` aliases that flag.
- `src/components/consent/CookieConsent.tsx` — copy now discloses Meta Pixel. Accept all / Reject / Manage preferences are unchanged.
- `src/lib/legal-copy.ts` — cookie and privacy copy describe Meta Pixel, `_fbp`, and that advertising cookies stay off until consent.
- `src/lib/paypal/csp.ts` — allow `connect.facebook.net` and `www.facebook.com` so the Pixel is not blocked by the existing CSP.
- `.env.example` — documents `NEXT_PUBLIC_META_PIXEL_ID` without a value.
- `docs/STOREFRONT_SECURITY_CLASSIFICATION.md` — Pixel ID must come from env, never invented in source.

### Commerce firing points

- `src/components/pdp/ProductViewRecorder.tsx` — existing `view_item` (unchanged call site) maps to ViewContent.
- `src/components/pdp/ProductHero.tsx` — existing successful `add_to_cart` maps to AddToCart. Still after `result.status === "added"` only.
- `src/components/discovery/CollectionTemplate.tsx` — existing `search` beacon maps to Search.
- `src/components/checkout/CheckoutPage.tsx` — `begin_checkout` now includes catalogue product ids, quantities, and GBP value for InitiateCheckout.
- `src/components/checkout/CheckoutReview.tsx` — `add_payment_info` after a successful PayPal `createOrder` initiation. Not on button mount. Not on Purchase.
- `src/components/checkout/IndiaPayment.tsx` — `onPaymentStarted` after a successful India initiation, before checkout.js opens.
- `src/services/checkout-confirmation.ts` — confirmation items now include `productId` from the order snapshot so Purchase can send catalogue ids without PII.
- `src/components/checkout/OrderConfirmation.tsx` / `OrderConfirmationPurchase.tsx` — Purchase only when `loadCapturedCheckoutConfirmation` returned a captured order. Retries on consent and Pixel-ready. Sent marker written only after a queued dispatch.

### Tests

- `scripts/verify-meta-pixel.ts` — consent, init, PageView, commerce events, failed init retry, Purchase dedupe, source guards that payment capture never fires Purchase.
- `scripts/verify-legal.ts` — advertising cookies stay off until consent; Meta Pixel named.
- `package.json` — `verify:meta-pixel`.

Payment capture, order commit, inventory, shipping, and Resend were not modified.

## Event names and actual firing points

| Meta event | Analytics event | Fires when |
| --- | --- | --- |
| `PageView` | `page_view` | Storefront route changes via `AnalyticsPageView`, plus one current-path PageView after Pixel init. Duplicate same-path events within 1.5s are dropped. The init snippet does **not** auto-fire PageView. |
| `ViewContent` | `view_item` | Product detail `ProductViewRecorder` after the PDP mounts for a real product id. |
| `AddToCart` | `add_to_cart` | PDP Add to bag **succeeds** (`status === "added"`). Not on render, not on a failed add. |
| `Search` | `search` | Search results collection (`CollectionTemplate` beacon) for an actual query. Autocomplete keystrokes stay on other analytics names and are not sent to Meta. |
| `InitiateCheckout` | `begin_checkout` | Checkout page visit with bag items. Empty bag does not fire. |
| `AddPaymentInfo` | `add_payment_info` | PayPal: after `initiateCheckoutPaymentAction` returns `ok`. India: after `initiateIndiaCheckoutAction` returns `ok`. Cancel, decline, and failed initiation do not fire it. |
| `Purchase` | `purchase` | `/checkout/confirmation` only, after `loadCapturedCheckoutConfirmation` returns `confirmed` (`payment_status = captured` / `PAYMENT_SUCCEEDED`). |

Monetary events send `currency: "GBP"`, catalogue `content_ids` (`product.id` / `order_items.product_id`), quantities, and GBP `value`. `content_type` is `product` where ids are present.

These do **not** fire Purchase: payment initiation, PayPal popup, Razorpay modal, pending/created payment, failed or cancelled payment, `verifyCheckoutPaymentAction` / `captureVerifiedPayment` / webhooks, or an unpaid confirmation URL.

## Consent integration behavior

- One existing banner. No second banner.
- Advertising tracking uses the existing analytics consent flag (`hasAdvertisingConsent()`).
- Unset, Reject non-essential, and analytics-off: Pixel script is not initialized; `fbq` events are not dispatched.
- Accept all, or analytics checked in Cookie settings: Pixel may load (if `NEXT_PUBLIC_META_PIXEL_ID` is set), then `fbq('consent', 'grant')` and `init`.
- Withdrawal (reject / turn analytics off): `fbq('consent', 'revoke')` and further events are dropped.
- Version 2 storage (`v2.0|1.<date>`). A previous v1 choice is ignored so the banner asks again before advertising cookies run.
- Cookie policy and privacy copy describe Meta Pixel. `_fbp` is listed as set only after consent.

## Purchase verification and deduplication design

Authoritative paid order path (unchanged):

1. PayPal or Razorpay client return calls the existing server verify action.
2. `captureVerifiedPayment` commits `orders.payment_status = captured`.
3. `onVerifiedPaymentCaptured` sends the Resend order email. Analytics is not called here.
4. The browser navigates to `/checkout/confirmation?ref=...`.
5. `loadCapturedCheckoutConfirmation` re-reads the captured order and matching customer/guest identity. Unpaid, pending, cancelled, and mismatched emails return `not_confirmed` and render the unpaid state **without** `OrderConfirmationPurchase`.

Purchase event:

- Stable `eventID` = `shu_purchase_<order_reference>`.
- In-memory set plus `sessionStorage` key `shadesuk.purchase.sent.<order_reference>`.
- The sent marker is written **only after** Pixel is initialized and `fbq('track', 'Purchase', ...)` has been called.
- If consent is missing or script load fails, the marker is not written. Confirmation subscribes to consent changes and `shadesuk:meta-pixel-ready` and retries.
- Reloads and duplicate callbacks after a successful send are skipped.

### Limitations (not exactly-once)

- Browser Pixel only. Conversions API is out of scope. If the tab is closed before init succeeds, or the Facebook script is blocked, Purchase may never reach Meta.
- The sent marker is `sessionStorage` (this tab). A second tab that opens the same confirmation URL after a successful send in another tab can send another Purchase. Meta may still dedupe by `eventID` if both arrive.
- This is not a claim of exactly-once delivery, and it is not production-verified in Events Manager.

## Environment variables required

| Name | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_META_PIXEL_ID` | Yes, to enable Pixel | Public numeric Pixel ID. Empty keeps Pixel disabled. Do not hardcode it in source. Do not invent a value. |

No server secrets were added. CAPI access tokens are intentionally absent.

## Test results

Commands and results will be recorded after `tsc`, lint, `verify:meta-pixel`, related verify scripts, and `npm run build` on this branch.

## Unresolved limitations

- No Meta Events Manager Test Events pass has been run against a deployed host.
- No Pixel ID is present in this environment, so a live browser cannot queue real Facebook hits here.
- Exactly-once Purchase delivery cannot be guaranteed without the Conversions API and a server-side sent flag.
- Vercel Analytics in the root layout is unchanged and is still not gated by this cookie banner.

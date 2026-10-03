# SHADESUK production handoff report

Status: **PASS WITH KNOWN NON-BLOCKING ITEMS**

One branch: `cursor/production-handoff-1d7a`. Not merged. Live PayPal cutover was not performed.

## A. Executive summary

The existing PayPal checkout, Resend order/shipment email, admin fulfilment, and guest-tracking security were inspected and left in place. This branch fills the gaps that were not already satisfied:

- Server-authoritative order cancellation (12 hours or before shipping confirmation, whichever is first), including a database lock against concurrent dispatch and a PayPal refund attempt after the order is marked refunded.
- New public order references are 4-digit codes. Internal ids stay UUIDs. Legacy `SHU-` references still resolve. Guest lookup still requires the checkout email.
- UK cookie consent with Accept all, Reject non-essential, and Manage preferences. Analytics does not run before consent.
- Returns, damage, cancellation, and PayPal FAQ copy, without inventing a support email.
- Featured collection root cause: mobile CSS hid products 3 and 4 with `display: none`. They now scroll.
- Homepage gender labels read Men / Women / Unisex with a visible arrow. Footer Instagram uses the supplied URL. The existing wordmark remains the brand mark.

## B. Files changed

### Payment and email

- `src/lib/payment/initiate.ts`, `src/lib/payment/pending-store.ts` — retry when a new reference collides.
- `src/lib/paypal/refund-capture.ts` — refund a captured PayPal payment. Used only after cancellation commits.
- `src/lib/email/config.ts`, `src/lib/email/service.ts`, `.env.example` — optional `RESEND_REPLY_TO`. No second provider. `PAYPAL_MODE` stays sandbox.

### Orders

- `src/contracts/order/reference.ts` — 4-digit generator plus legacy parser.
- `src/contracts/order/cancellation.ts` — eligibility policy.
- `src/contracts/order/dto.ts` — cancelled includes refunded; surfaces receive `cancellationEligible`.
- `src/services/order-cancellation.ts` — account and guest entry points.
- `src/services/admin-orders.ts` — dispatch treats `order_not_dispatchable` as a blocked fulfilment write, and status sync requires `payment_status = captured`.
- `supabase/migrations/20261003104500_order_cancellation_guard.sql` — row locks, cancellation RPC, shipment trigger.
- `src/components/order/CancelOrderForm.tsx` and account/guest order surfaces.

### Storefront

- `src/components/home/ProductSection.module.css`, `ProductSection.tsx` — featured/new-arrival mobile rail.
- `src/components/home/GenderDiscovery.tsx` — Men →, Women →, Unisex →.
- `src/lib/navigation.ts`, `src/components/navigation/SiteFooter.tsx` — Instagram.
- `src/components/consent/*`, `src/lib/cookie-consent.ts`, `src/lib/analytics.ts` — consent.
- `src/lib/legal-copy.ts`, `src/components/info/ContactPage.tsx`, `src/lib/support-email.ts`.
- `src/lib/seo.ts` plus home, FAQ, and product pages — organisation, FAQ, and breadcrumb schema.

### Tests and notes

- `scripts/verify-cancellation.ts` and updates to contract, tracking, legal, and admin-order checks.
- `docs/PHASE3_DATA_CONTRACTS.md`, `docs/PHASE3_GUEST_TRACKING.md` — reference format note only.

## C. Database changes

Migration `20261003104500_order_cancellation_guard.sql` (not applied from this environment):

- Trigger `shipments_require_captured_payment`. A confirming shipment (`dispatched`, `in_transit`, `out_for_delivery`, `delivered`, `tracking_unavailable`, or any `shipped_at`) requires `orders.payment_status = captured`, with the order row locked.
- Function `cancel_order_if_eligible(uuid, uuid, text, text)`, security definer, executable by `service_role` only.
- Writes `order_events.event_type = order_cancellation_requested` with actor kind, optional reason, previous payment status, final payment status `refunded`, and `payment_action = refund_required`.
- No new columns. No change to the order primary key. Existing `order_reference` unique constraint is the uniqueness lock for 4-digit codes. Legacy values are not rewritten.

Apply this migration before cancellation is used in production.

## D. Payment changes

EXISTING — VERIFIED, then extended only for cancellation refunds:

- Provider remains PayPal. Variable names remain `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`.
- `PAYPAL_MODE` was not set to `live`. Sandbox stays until Syed cuts over.
- Server capture remains authoritative (`capture-verified`, webhook verify, idempotent webhook store). Browser success does not mark an order paid.
- Duplicate capture, amount, and currency checks were already in the capture path.
- New: after a cancellation commits, `refundPayPalCapture` calls `POST /v2/payments/captures/{id}/refund` with `PayPal-Request-Id = cancel-refund:{orderId}`. A failed refund does not reopen dispatch. The result is `order_cancellation_refund`.

## E. Email changes

EXISTING — VERIFIED:

- Order confirmation still runs from `onVerifiedPaymentCaptured` after a committed capture. Email failure does not roll back the order.
- Order shipped still runs from `onShipmentConfirmed` after a real shipment confirmation. Pending and exception shipments do not send it.
- Idempotency keys remain `order_confirmation:{order_id}` and `shipment_confirmation:{shipment_id}`.
- Resend webhook verification and delivery persistence were not rebuilt.
- Added optional `RESEND_REPLY_TO`. Empty is valid. A non-empty invalid address fails Resend config closed. There is no development-sender fallback.

## F. Order changes

- Cancellation is available on Account → Orders → Order detail, and on Track order after the existing email grant. The server decides eligibility.
- Window: under 12 hours from `orders.created_at`, and no shipping confirmation. A pending shipment draft does not close the window.
- Failed, unpaid, and checkout attempts are not cancellable purchases. A second request on an already refunded order does not write another cancellation event.
- Captured orders move to `payment_status = refunded`, which existing account and guest views already treat as a committed purchase, and which this branch also shows as cancelled.
- Public reference for new orders is four digits. UUID stays internal. Emails, admin lists, account orders, and Track order already render `order_reference`, so they pick up the new value without a second template.
- Guessing `4827` without the checkout email does not return order data. That check was already in guest tracking and is covered by `verify:tracking`.

## G. Frontend changes

- Featured collection: `.mobileTwo` set `li:nth-child(n + 3) { display: none }` below 768px, so products 3 and 4 were in the payload and unreachable. Mobile now shows two cards and scrolls to the rest. Desktop keeps the locked 4-column product grid. No carousel library.
- Gender: the homepage cards say Men →, Women →, Unisex → and still link to `/men`, `/women`, and `/unisex`. Nav labels stay Men / Women / Unisex.
- Cookie banner: Accept all and Reject non-essential use the same button weight. Manage preferences opens the existing focus-trapped modal. Cookie settings in the footer reopens it. Choice is stored in `localStorage` and `shadesuk_cookie_consent` (about 180 days).
- FAQ, returns, shipping, terms, privacy, and cookies were updated in the existing copy module. No new routes.
- Instagram: `https://www.instagram.com/shades.uk?stkn=cHRzcDN6MGduW2Rq&utm_source=qr` in the footer, new tab.
- Monogram: the repo’s official mark is `public/brand/shadesuk-wordmark.jpg`, already linked home with an accessible name. No separate S monogram file exists, so none was invented.

## H. SEO changes

EXISTING — VERIFIED for the metadata helper, canonicals, homepage H1, product schema, robots disallow list, sitemap, and noindex on filtered catalogue URLs and private routes.

Added:

- Organisation schema on the homepage, including the Instagram URL.
- FAQPage schema from the canonical FAQ groups.
- BreadcrumbList on product pages (Home, Shop, product).

No ranking claim. Legal wording is not certified.

## I. QA

Ran:

- `tsc --noEmit`
- `npm run build` (Next.js 16.3.4, compiled and generated static pages)
- `verify:contracts`, `verify:tracking`, `verify:legal`, `verify:cancellation`, `verify:admin-orders`, `verify:account`, `verify:account-orders`, `verify:checkout`, `verify:email`, `verify:payment`, `verify:payment-capture`, `verify:payment-webhook`, `verify:payment-verify`, `verify:payment-final`
- ESLint on the files this branch touched

Not run here:

- A signed-in browser pass against a live Supabase project
- A PayPal sandbox approval, cancel, and webhook delivery (no credentials in this environment)
- A Resend send (no API key)
- Applying the cancellation migration to the production database
- A full WCAG contrast/screen-reader pass and a mobile/desktop screenshot pass

`npm run lint` still reports two existing issues in files this branch did not change: `src/components/pdp/ProductHero.tsx` (manual memoization) and unused imports in `src/lib/paypal/capture-order.ts` and `src/services/checkout.ts`.

## J. Known limitations

- 4-digit references exhaust at 10,000 unique values. Inserts retry up to 8 times, then checkout fails rather than issuing a duplicate. Legacy `SHU-` references do not consume that space.
- Cancellation does nothing in production until the new migration is applied.
- If PayPal refund fails after the order is marked refunded, the order stays undispatchable and the refund event records failure. Someone must refund in PayPal or retry. The order is not shipped.
- `RESEND_REPLY_TO` is unset in the repo, so Contact still says a public email has not been published. No address was invented.
- UK legal copy is operational draft language. It is marked as not legal advice and is not a certification.
- No separate S monogram asset is in the repository.
- Live PayPal credentials and `PAYPAL_MODE=live` are intentionally unchanged.

## K. Production environment requirements

Do not commit these values.

PayPal (existing names; leave sandbox until Syed says otherwise):

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MODE` = `sandbox` until live cutover, then `live`
- `PAYPAL_WEBHOOK_ID`
- Webhook URL: `POST /api/webhooks/paypal`

Resend (existing names):

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (verified domain; no silent dev sender)
- `RESEND_FROM_NAME`
- `RESEND_ORDER_CONFIRMATION_TEMPLATE_ID`
- `RESEND_SHIPMENT_CONFIRMATION_TEMPLATE_ID`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_REPLY_TO` (optional; also the Contact address when it is a valid mailbox)
- Webhook URL: `POST /api/webhooks/resend`

Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key)
- `SUPABASE_SECRET_KEY` (or legacy service role). Server only.
- Apply `supabase/migrations/20261003104500_order_cancellation_guard.sql`

Site:

- `NEXT_PUBLIC_SITE_URL` on the production HTTPS origin
- `GUEST_COOKIE_SECRET` in production

## L. Final acceptance status

**PASS WITH KNOWN NON-BLOCKING ITEMS**

P0 code paths that already existed (PayPal capture, webhook verification, order confirmation, shipment email, admin dispatch, guest email verification) were not rewritten. Cancellation, the 4-digit reference, cookie consent, and the featured-rail bug are implemented in this branch. Production still needs the migration applied, the existing secrets confirmed, and Syed’s explicit PayPal live cutover. This branch is not merged.

## Inventory

| Area | Result |
| --- | --- |
| PayPal create / capture / webhook / idempotency | EXISTING — VERIFIED |
| PayPal live credential cutover | Held for Syed |
| PayPal refund after cancellation | CHANGED |
| Resend confirmation and shipped templates, idempotency, webhook | EXISTING — VERIFIED |
| `RESEND_REPLY_TO` | CHANGED |
| Admin fulfilment and manual shipment | EXISTING — VERIFIED, dispatch guard added |
| Account and guest tracking security | EXISTING — VERIFIED |
| Cancellation pipeline | CHANGED |
| 4-digit public reference | CHANGED |
| Cookie consent | CHANGED |
| Legal / FAQ / contact | CHANGED |
| Featured collection | CHANGED |
| Shop by gender | CHANGED |
| Instagram | CHANGED |
| Monogram | EXISTING — VERIFIED (wordmark; no separate S asset) |
| SEO metadata system | EXISTING — VERIFIED, schema gaps filled |
| Razorpay | No work. Stale comments already mark it retired |

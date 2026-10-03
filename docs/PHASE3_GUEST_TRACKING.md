# SHADESUK Phase 3 — Guest order tracking

**Phase:** 3.13 (guest order tracking)  
**Status:** Partial — `/track-order` form, server lookup, rate limit, secure result view. No paid orders until the payment handoff.  
**Stacked on:** [PR #17](https://github.com/Shadesuk/Shadesuk-live/pull/17) (`cursor/phase3-account-auth-6a34`)

This slice adds guest order tracking so the footer **Track Order** link no longer 404s. Guests verify with the public `order_reference` **and** email. New references are 4 digits and are guessable on their own, so the email check stays mandatory. Legacy `SHU-` references still resolve. Admin dashboard, payment charge/SDKs/webhooks, and carrier APIs are out of scope.

## Wired

- `/track-order` — locked form (**Order reference** + **Email** + **Track order**)
- Server Action lookup against PR #10 `orders` / `order_items` / `shipments` / `tracking_events`
- Service-role read only after rate-limit + parse; anon still has no SELECT on orders
- Timing-safe email compare (`SHA-256` + `timingSafeEqual`); dummy compare when no row exists
- Generic error for malformed input, unknown reference, and wrong email: **We couldn't find an order with those details.**
- In-app rate limit (not a WAF): 5 attempts / 15 minutes, AND-ed across a **signed httpOnly limiter cookie**, IP, email fingerprint, and order reference. Malformed refs share an `invalid` bucket. Additional caps: 8 / reference, 10 / IP, 8 / email, 10 / client.
- IP is **not** the spoofable leftmost `X-Forwarded-For`. Prefer `x-vercel-forwarded-for` on Vercel, `cf-connecting-ip` when `cf-ray` is present, otherwise the **rightmost** XFF hop. The signed cookie + email + reference buckets still bind if an IP header is forged.
- Limiter cookie HMAC uses the same fail-closed production secret as guest cart cookies (`GUEST_COOKIE_SECRET` or a Supabase secret). Unsigned cookies are ignored. The limiter id is never returned in action JSON and is not the cart `session_id`.
- Result view uses `GuestOrderTrackingView` only (status, items, total, delivery snapshot, customer shipment fields)
- Manual fulfilment: show pasted tracking URL / AWB when present on `shipments`; no carrier API
- **TRACKING NOT AVAILABLE YET** is a normal state
- Footer **Track Order** → `/track-order`
- CSRF/origin on the mutation; ownership keys (`sessionId`, `cart_id`, …) rejected
- Page is `noindex`

## Stubbed / not in this slice

- **Paid orders** — payment charge, SDKs, and webhooks are still out of scope. Until those land, live `orders` rows may be empty. Lookup then returns the generic not-found state (demo-safe).
- **Admin dashboard** — operators cannot yet paste AWB/URL in-product; if a row already has `tracking_url` / `tracking_number`, the customer view shows it
- **Shipping / carrier APIs** — no Royal Mail (or other) API; the **Track with carrier** link is the pasted HTTPS URL only
- **`/order/[id]`** — not created. Guessable order URLs must not reveal orders
- **Account order history / order detail** — still the empty placeholder from PR #17
- **Post-verify tracking session cookie** — success is shown on `/track-order` after POST; refresh returns to the form

## Security

- Forbidden: `/order/12345` or `/order/{reference}` revealing an order without verification
- Never reuse `CustomerOrderView` (it may contain payment provider ids) — guest tracking uses `GuestOrderTrackingView`
- Shipment `notes` are not selected
- `payments` is not queried
- Production cookie HMAC fail-closed behaviour from PR #17 is unchanged (limiter cookie included)
- Guest `session_id` is never sent to the browser
- Tracking limiter id is never sent to the browser
- No admin UI; no payment APIs

## Copy

Locked language from `account_order_tracking.md` is preserved (Track your order, Order reference, Email, Track order, tracking timeline labels, Tracking not available yet, Delivery update, Track with carrier, Minimum 2 weeks).

## Verify

```bash
npm run verify:tracking
npm run verify:contracts
npm run verify:account
npx tsc --noEmit
npm run lint
npm run build
```

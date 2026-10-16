# Storefront security classification

**Phase:** 3 storefront completion harden (SEO / a11y / UI-state / Impeccable)  
**Stacked on:** `cursor/phase3-live-catalogue-search-1879` (PR #20)  
**Locks:** no Razorpay/payment, no admin, no shipping APIs, no merge to `main`.  
**Date:** 15 September 2026

Vocabulary:

| Class | Meaning |
| --- | --- |
| **BLOCKING** | Must be fixed before this surface can be considered production-safe. |
| **NON-BLOCKING** | Real finding; does not block this storefront-completion slice. Fix before launch if still open. |
| **DEFERRED** | Out of scope for this slice because of an explicit lock, missing provider, or later phase. |

Prior Mediums carried from PRs #15–#19 and the 3.1 security appendix.

---

## Cheap wins implemented in this slice

| Item | Class | Status |
| --- | --- | --- |
| Guest tracking URLs https-only | NON-BLOCKING (was Medium: `javascript:` already rejected; `http` still rendered) | **Fixed.** `safeHttpUrl` now allows `https:` only. `http`, `javascript:`, and protocol-relative values are dropped. |
| Cookie HMAC fail-closed in production | BLOCKING for checkout/cart cookies | **Already in** (PR #16 / checkout shell). Not reopened. |
| Legal/help hrefs https-only | NON-BLOCKING | **Already in** (PR #19). Not reopened. |
| Guest tracking lookup requires reference + email + rate limit | BLOCKING for `/track-order` | **Already in** (PR #18). Not reopened. |
| Root robots fail-closed (`index: false`) with opt-in indexable pages | NON-BLOCKING / SEO | **Kept and completed.** Catalogue, home, and legal opt in; search/account/cart/checkout/track-order stay noindex. |
| Rate-limit `GET /api/search/suggest` | BLOCKING for pre-launch search | **Fixed.** Process-local 20/10s burst + 60/min per resolved IP. 429 + `Retry-After`. |
| Cache published snapshot for suggest (do not re-page ≤2000 rows per keystroke) | BLOCKING for pre-launch search | **Fixed.** 60s TTL + in-flight coalesce on `fetchLivePublishedCatalogue`. Fuzzy correction scans ≤64 nearby dictionary terms. Published-only stays. |
| Ignore `DEMO_CATALOGUE` in production | BLOCKING if fixtures can ship as live | **Fixed.** Flag is ignored when `VERCEL_ENV=production` or `NODE_ENV=production` outside Vercel preview. Preview may still force fixtures. |
| `getCollectionProducts` must not default to demo | BLOCKING if omitted snapshot serves Frame 01–06 | **Fixed.** Snapshot `products` is required. `queryCollection` / `getFilteredProductCount` fail closed the same way. |
| `catalogue.ts` / demo fixtures server-only | NON-BLOCKING (client already stopped importing) | **Fixed.** `import "server-only"` on `src/data/catalogue.ts` and `src/services/catalogue.ts`. |
| Homepage live-error vs empty rails | NON-BLOCKING / honesty | **Fixed.** Empty DB still omits rails. Live fetch error shows “We couldn’t load products.” and does not look like an empty catalogue. |

---

## Remaining items

### Payment / webhooks

| Item | Class | Phase reason |
| --- | --- | --- |
| Payment secrets server-only | **DEFERRED** | Payment lock. No Stripe/Razorpay SDK or env names invented. |
| Webhook signature verification + idempotent event ids | **DEFERRED** | Payment lock. `payment_webhook_events` exists in schema; no handler yet. |
| Frontend must not mark paid from `?success=` | **DEFERRED** | No payment return route. Required when 3.9 exists. |
| `add_payment_info` / `purchase` analytics | **DEFERRED** | Must fire only after backend-verified payment. Confirmation refresh must not double-count. Event bus is ready; providers and order-confirmation are not. |

### Admin / operations

| Item | Class | Phase reason |
| --- | --- | --- |
| Admin UI / admin API protection | **DEFERRED** | Admin lock. No admin routes in this storefront. |
| Health oracle `GET /api/health/supabase` unauthenticated + no rate limit | **NON-BLOCKING** | Production body is redacted (`{ ok, checkedAt }`). Still an availability oracle. Network restriction or shared-secret header is a later harden, not a storefront-completion blocker. |
| Unauthenticated admin-client data leak | **BLOCKING** if any public GET starts returning service-role rows | **Already the hard rule.** Catalogue reads use publishable/anon + RLS. Guest tracking uses verified lookup, not a public order URL. |

### Auth / account

| Item | Class | Phase reason |
| --- | --- | --- |
| Session refresh on `/account/**` and `/auth/**` | **NON-BLOCKING** | Implemented via Next.js 16 `src/proxy.ts` matcher. Guest checkout stays outside the matcher. |
| Client-only redirects as authorisation | **BLOCKING** if used | Server layouts/actions remain the gate. Do not add client-only account guards. |
| Google OAuth redirect allow-list | **NON-BLOCKING** | Needs the locked production origin (`NEXT_PUBLIC_SITE_URL`). Not invented here. |

### Guest tracking / cart

| Item | Class | Phase reason |
| --- | --- | --- |
| Guessable `/order/12345` | **BLOCKING** if introduced | **Not present.** Lookup is `/track-order` + reference + email. |
| Rate-limit buckets beyond spoofable `X-Forwarded-For` | **NON-BLOCKING** | Already tightened (IP + limiter cookie + canonical reference). |
| Guest session id in RSC/action JSON | **BLOCKING** if regressed | Already stripped. Do not serialise ownership keys to the browser. |

### Catalogue / search

| Item | Class | Phase reason |
| --- | --- | --- |
| Entire catalogue in the client bundle | **BLOCKING** at live cutover | **Addressed on PR #20.** Cards receive props; suggestions go through `/api/search/suggest`. Keep it that way. |
| Demo fixtures served as live in production | **BLOCKING** | **Fixed in this slice.** `DEMO_CATALOGUE` is ignored on the production origin. Demo remains allowed in `next dev` and Vercel preview. |
| Suggest endpoint unauthenticated scrape / snapshot cost | **BLOCKING** pre-launch | **Fixed in this slice.** Rate limit + TTL snapshot cache. Published-only. Process-local only — edge/WAF still recommended at launch. |
| Suggest rate-limit buckets beyond spoofable `X-Forwarded-For` | **NON-BLOCKING** | Same as tracking: platform headers + rightmost hop. Signed suggest cookie not added (would mint on every keystroke). |
| Full-text / Postgres search instead of in-memory snapshot | **DEFERRED** | Later search scale-up when published count exceeds the 2000-row cap. Cache + bound fuzzy match is the this-phase control. |

### Analytics / SEO

| Item | Class | Phase reason |
| --- | --- | --- |
| Invented GA / GTM / pixel ids | **BLOCKING** if added | Pixel ID is read only from `NEXT_PUBLIC_META_PIXEL_ID`. It is not hardcoded. The analytics bus still no-ops until a provider is registered and consent is granted. |
| Indexing filter/search/account URLs | **NON-BLOCKING** | Search is noindex + robots disallow. Filter query strings canonicalise to the clean collection path and are noindex. |
| Canonical production origin | **NON-BLOCKING** | `NEXT_PUBLIC_SITE_URL` still a human lock-in. Sitemap/robots/metadataBase stay provisional until the HTTPS origin is confirmed. |

### Shipping / fulfilment

| Item | Class | Phase reason |
| --- | --- | --- |
| Carrier / Royal Mail APIs | **DEFERRED** | Shipping API lock. Manual fulfilment + pasted https tracking URL only. |
| Address-autocomplete vendor keys | **DEFERRED** | Provider unset. Manual address form remains complete. |

---

## Launch gate (not this PR)

Do not claim production-ready while these remain **DEFERRED** and required by the Phase 3 handoff: payment, webhooks, order confirmation, fulfilment, and a named analytics provider. This slice hardens the storefront around those locks rather than pretending they are done.

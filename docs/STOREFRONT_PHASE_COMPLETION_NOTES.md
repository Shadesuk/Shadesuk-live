# Storefront phase completion notes

Evidence pack for the eventual Phase 3 Completion Report. This is **not** a claim that Phase 3 is done. Payment, admin, shipping APIs, and merge to `main` remain locked out.

**Branch:** `cursor/phase3-storefront-completion-harden-7a8a`  
**Base:** `cursor/phase3-live-catalogue-search-1879` (PR #20)  
**Date:** 15 September 2026  
**Specs used:** Phase 3 handoff, `seo_performance.md`, `responsive_accessibility.md`, `global_components_ui_states.md`, Impeccable skill in repo (`SKILL (1).md`). Master spec file is not in the repository.

---

## A. What this slice completed

- SEO: titles, descriptions, canonicals, Open Graph, Product JSON-LD, sitemap (home + catalogue + brands + collections + live products + legal), robots disallow for private/transactional paths, search noindex.
- Root indexation policy: layout stays fail-closed `noindex`; home / catalogue / legal opt in.
- FAQ payment copy softened (not live / planned checkout language).
- Analytics: provider-agnostic event bus + key events. No GA ids.
- Shared empty / error / loading / unavailable language across discovery → PDP → cart → checkout → account → tracking → legal.
- WCAG 2.2 AA targeted fixes on chrome + purchase path.
- Clear 320px header overflow and checkout-step contrast bugs.
- Tracking URLs https-only.
- PR #20 fold-in: suggest rate-limit + snapshot cache; `DEMO_CATALOGUE` ignored in production; collection queries fail closed without a snapshot; demo catalogue is server-only; homepage live-error is distinct from empty rails.
- Bounded Impeccable inspection on home, PLP, PDP, cart, checkout, account (one defect pass + at most one confirmation).

---

## B. Routes (direct load / refresh)

Indexable (opt-in):

```text
/
/shop
/men
/women
/unisex
/new-arrivals
/best-sellers
/collections
/collections/[slug]
/brands
/brands/[slug]
/product/[slug]
/about
/contact
/faq
/shipping-policy
/refund-policy
/terms
/privacy-policy
/cookie-policy
```

Noindex (inherit or explicit):

```text
/search
/cart
/checkout
/account/**
/track-order
/auth/**
```

Filter/sort/limit query strings on catalogue URLs: **noindex**, canonical = clean path.

404: branded EmptyState (“This page doesn’t exist”) with path back to `/shop`. Unknown product/brand/collection slugs keep dedicated unavailable states.

---

## C. Journeys exercised in this slice

| Journey | Evidence |
| --- | --- |
| Home → Shop → product card | Shared `CollectionTemplate` / `ProductCard`; live or empty catalogue, never silent demo in production |
| Search overlay → results → PDP | `/search` noindex; suggestions via `/api/search/suggest`; no-results copy `No results for “{query}”` |
| PDP → Add to bag → Bag drawer → Cart → Checkout | Add-to-bag still server-confirmed; drawer empty title aligned; checkout empty bag uses EmptyState instead of a blank screen |
| Guest track order | `/track-order` noindex; https-only carrier URL |
| Account | Existing auth surfaces; route error/loading added |
| Legal | FAQ payment future-tense; sitemap includes `INFO_PAGES` |

Payment charge, confirmation, and purchase analytics are **not** exercised (locked).

Refresh / back-forward:

- Catalogue filters live in the URL (`scroll: false` on apply).
- Cart and checkout drafts remain cookie-backed.
- Search query is the `q` param.
- Checkout with an empty bag now shows the empty-bag EmptyState while redirecting to `/cart` instead of rendering `null`.

---

## D. Accessibility (WCAG 2.2 AA targeted)

Fixed in this slice:

- Checkout step labels no longer use 48% opacity (failed ~3.4:1). Current step uses an underline token; all steps stay full-contrast text.
- `--color-error` / `--color-text-secondary` tokens exist and alias navy (no invented red/grey that would fail contrast). Errors also use `role="alert"` / `aria-invalid`, not colour alone.
- Bag: `aria-controls`, `aria-expanded`, `aria-haspopup="dialog"`, close `aria-label="Close bag"`, polite live region for item count, empty-bag heading in the drawer.
- Quantity on PDP announces via `aria-live="polite"`.
- Route-level empty/unavailable/404 headings are `h1` where they are the page title.
- Search keeps a visible programmatic label (not placeholder-as-label).
- Focus-visible outline unchanged; skip link unchanged; drawers/modals keep focus trap + Escape + restore.

Residual gaps (documented, not this-PR blockers):

- No automated axe/Pa11y CI gate yet.
- No screen-reader pass on VoiceOver / TalkBack hardware.
- Sticky PDP CTA duplicates the in-page button when visible (touch/keyboard both work; SR may hear two “Add to bag” controls).
- Colour swatches are `aria-pressed` buttons, not a radiogroup.
- Zoom at 200% / 400% and text-spacing (WCAG 1.4.12) not fully matrixed.
- Focus order through Shop mega-menu on desktop not re-audited beyond Escape-to-close.
- `prefers-reduced-motion` still only zeros `--duration`; no separate motion audit.

---

## E. Responsive matrix

Locked breakpoints: `<768` mobile, `768–1199` tablet, `1200+` desktop, `1440+` large (4-column grid, more whitespace).

| Width | Result |
| --- | --- |
| 320 | Header overflow (wordmark + Search + Bag) **fixed**: tighter gap, 1.25rem wordmark, zero util gap. Filter + sort wrap. |
| 360 / 390 / 430 | Header 3-column compact chrome; 2-column product grid; PDP stacked; sticky purchase bar with safe-area padding. |
| 768 / 834 | 3-column grid; cart/checkout two-column summary. |
| 1024 / 1199 | Still tablet chrome (hamburger). Filter drawer is bottom sheet until 1200. |
| 1200 / 1280 / 1440 / 1600+ | Desktop nav; 4-column grid (not 5–6); sticky bag/checkout summary under header + safe area. PDP sticky bar hidden. |

Bugs found and fixed:

1. **320px header** — Search + Bag could not fit beside the wordmark.
2. **Checkout step contrast** — inactive steps at 0.48 opacity failed AA for text.
3. **Long product names** — `overflow-wrap: anywhere` on cards and PDP title.
4. **Sort select min-width** — reduced so Filter + Sort can share 320px.

Not a code bug, documented:

- Tablet (768–1199) correctly keeps the mobile header/menu per locked chrome (desktop nav is 1200+).
- Product grid stays 4 columns at 1600+ (locked; extra space becomes gutter).

---

## F. SEO

| Requirement | Status |
| --- | --- |
| Clean URLs | Pass (existing) |
| Titles + descriptions | Pass (catalogue, product, legal, home) |
| Canonicals | Pass; filtered PLPs canonicalise to the clean path |
| Product JSON-LD | Pass when the product exists; omits invented images/descriptions |
| Image alt | Pass (existing product alt; decorative secondary image `alt=""`) |
| Sitemap | Home, gender, merch, shape collections, brand index, live brands/products, legal. Demo product slugs are **not** listed. Search/cart/account/checkout/track-order omitted. |
| robots.txt | Allow `/`; disallow `/search`, `/account`, `/checkout`, `/cart`, `/track-order`, `/api/`, `/auth/` |
| Search noindex | Pass (`privatePathMetadata` + robots disallow) |
| Root indexation policy | Fail-closed at layout; opt-in on meaningful pages |
| Branded 404 | Pass |
| No filter-URL explosion | Pass |

---

## G. Analytics

Implemented: no-op bus in `src/lib/analytics.ts`. `registerAnalyticsProvider` is the only extension point. Payloads drop email/password/token/address keys.

Wired now (no-op until a provider exists):

```text
page_view
view_item
select_item
select_colour
select_size
open_size_face_guide
search
search_open
search_started
search_query
search_suggestion_view
search_suggestion_click
search_result_view
search_result_click
search_no_results
search_filter_used
search_sort_used
add_to_cart
remove_from_cart
view_cart
begin_checkout
address_autocomplete_used
address_manual_entry
track_order
filter_used
sort_used
recommendation_click
recently_viewed_click
```

**DEFERRED (handoff contract, not this phase’s provider work):**

- `add_payment_info` — no payment UI.
- `purchase` — `trackPurchaseOnce(orderId)` exists but must not fire until backend-verified payment. Confirmation refresh protection needs an order-confirmation route.
- Named GA/GTM/pixel ids — **not invented**.
- Analytics cookies — cookie policy still correctly says none are set.

---

## H. Impeccable commands run

Repo skill: `SKILL (1).md` (Impeccable 4.2.0). Installed CLI launcher was **not** present under `.claude/skills/impeccable/scripts/`.

Commands / workflow followed:

1. Context from PRODUCT.md, DESIGN.md, brand_design.md, and the locked UI specs (equivalent to `impeccable context` + craft-floor constraints: no AI-slop, no second card system, no gold luxury clichés).
2. Defect inspection (desktop + mobile thinking) across **home, PLP, PDP, cart, checkout, account**.
3. One fix batch (contrast, 320px header, empty/error heading levels, bag empty title, checkout blank state, wrapping names).
4. At most one confirmation pass after those fixes.
5. **Stop.** No open-ended polish.

Playbook used in spirit: **harden** (errors, edge, a11y) rather than bolder/delight/overdrive.

---

## I. Known issues

```text
Severity: P2
Location: Payment / order confirmation
Problem: No charge, webhook, or confirmation route.
Impact: Cannot complete the locked purchase PA tests.
Recommended fix: Later payment slice against the locked provider.
Status: DEFERRED (explicit lock)
```

```text
Severity: P2
Location: Analytics provider
Problem: Events no-op; no destination.
Impact: No production measurement until a provider is registered.
Recommended fix: Register a real provider without putting ids in the repo until Syed supplies them.
Status: DEFERRED
```

```text
Severity: P3
Location: Sticky PDP CTA
Problem: Duplicate Add to bag control when the sticky bar is visible.
Impact: Screen-reader verbosity on mobile PDP.
Recommended fix: inert/hide the off-screen CTA or the sticky one from the a11y tree.
Status: Documented residual a11y gap
```

```text
Severity: P3
Location: GET /api/health/supabase
Problem: Unauthenticated availability oracle.
Impact: Attackers can probe whether keys currently authenticate.
Recommended fix: Rate limit or shared-secret header in a later harden.
Status: NON-BLOCKING
```

```text
Severity: P3
Location: NEXT_PUBLIC_SITE_URL
Problem: Canonical production origin not locked.
Impact: Sitemap/robots/OG URLs are provisional.
Recommended fix: Human lock-in of the HTTPS origin.
Status: NON-BLOCKING
```

---

## J. Browser verification (this slice)

Exercised against `DEMO_CATALOGUE=true npm run dev -- --port 3000` on 15 September 2026.

| Surface | Result |
| --- | --- |
| Home `/` | Wordmark + campaign chrome; `index, follow` metadata |
| Shop `/shop` | Product cards, filter/sort wrap |
| PDP `/product/frame-01` | Add to bag succeeds; bag drawer lists the line |
| Cart `/cart` | Empty-bag EmptyState when no lines; line item after add |
| Checkout `/checkout` | Empty bag redirects to `/cart` with EmptyState (no blank screen) |
| FAQ `/faq` | “How do I pay?” future-tense: not live yet |
| Search `/search?q=zzzzz` | `No results for “zzzzz”`; noindex |
| Account `/account` | Auth surface + route chrome |
| 404 `/this-page-missing` | “This page doesn’t exist” + View all shades |
| 320–380px header | MENU / wordmark / SEARCH / BAG fit without horizontal overflow |

SEO spot-checks: home `index, follow`; `/shop?colour=black` `noindex` + canonical `/shop`; search `noindex, nofollow`; PDP JSON-LD present.

---

## K. Verification commands

```text
npx tsc --noEmit
npm run lint
npm run build
npm run verify:storefront
npm run verify:search
npm run verify:catalogue
npm run verify:collections
npm run verify:discovery
npm run verify:contracts
npm run verify:pdp
npm run verify:cart
npm run verify:checkout
npm run verify:account
npm run verify:tracking
npm run verify:legal
npm run verify:completion
```

Production readiness: **NOT READY FOR PRODUCTION** (payment, fulfilment, named analytics, and PA against live payment remain open). Storefront completion harden for SEO/a11y/security/Impeccable in this slice is the evidence above.

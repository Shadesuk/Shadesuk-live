# SHADESUK Phase 3 — Repository Audit

**Phase:** 3.1 — Repository audit  
**Status:** Complete (audit only; no wiring). Security appendix added 2026-09-15.  
**Audited commit:** `a79678e` on `main`  
**Default branch:** `main`  
**Repository:** https://github.com/Shadesuk/Shadesuk-live  
**Date:** 2026-09-15  
**Scope:** Inspect existing stack, classify every required surface, inventory specs, and list mocked / hard-coded / missing areas. No backend wiring or feature implementation.

This audit is the Section 5 deliverable of the Phase 3 master implementation handoff. It does not reinterpret locked product, UI, or UX decisions. Genuine technical conflicts are reported as conflicts, not resolved.

Companion: [`docs/PHASE3_ENV_CONFIG_AUDIT.md`](./PHASE3_ENV_CONFIG_AUDIT.md) (Phase 3.2). Security findings that block later wiring are in **§12 Security appendix**.

---

## 0. How to read this document

Classification vocabulary (locked by the handoff):

| Status | Meaning in this repo |
| --- | --- |
| **Complete** | Surface exists, matches the approved frontend contract for its current phase, and is not a stub. Operational data may still be demo-backed; that is called out under Mocked. |
| **Partial** | Real UI/architecture exists, but a required behaviour, destination, or data source is unfinished. |
| **Mocked** | Behaviour uses in-memory / fixture data that is explicitly labelled demo, not live catalogue or live services. |
| **Hard-coded** | Values or copy are compiled into the UI rather than coming from a service. Static brand/editorial copy is allowed; operational/customer data is not. |
| **Broken** | A control or link exists but does not perform the promised action, or it lands on a missing route. |
| **Missing** | No implementation of the required surface. |

Frontend phases already shipped on `main` used a **different numbering scheme** (Phase 1 scaffold → Phase 7 brands/collections). Those are **not** this Phase 3. This document uses “Phase 3” only in the production-integration sense of the handoff.

---

## 1. Existing stack

| Layer | Finding |
| --- | --- |
| Framework | Next.js `16.3.4` App Router (`src/app`) |
| Language | TypeScript `^5`, `strict: true` |
| UI library | React `19.2.8` / React DOM `19.2.8` |
| Package manager | npm (`package-lock.json` present; no pnpm/yarn lock) |
| Build system | `next build` / `next start`; ESLint 9 + `eslint-config-next` |
| Routing | Next.js file-system routing. Catalogue routes live under `src/app/(catalogue)/`. No `middleware.ts`. |
| Styling | Global CSS tokens + CSS Modules. Locked palette/type/space in `src/styles/tokens.css`. Inter via `next/font/google`. No Tailwind, no CSS-in-JS. |
| Component architecture | Shared primitives (`ui/`, `layout/`, `product/`, `discovery/`, `navigation/`, `search/`, `home/`). One ProductCard / ProductGrid / FilterBar / SortControl / CollectionTemplate. |
| State management | No Redux/Zustand. Server Components fetch demo catalogue in-process. Client state is local React state plus `sessionStorage` (recently viewed) and `localStorage` (recent searches). Chrome overlay lock via `ChromeContext`. |
| Data-fetching | Direct function calls into `src/services/*`. No React Query, no SWR, no Route Handlers for catalogue. Search and filters run against the in-memory demo catalogue. |
| Existing backend | **Connection foundation only.** `@supabase/ssr` + `@supabase/supabase-js`. Browser / cookie-bound server / service-role admin clients. Health probe at `GET /api/health/supabase`. README states the CLI is **not linked** and **no migrations should be run from this checkout**. |
| Database | **Not in `main`.** Spec: `SHADESUK_Database_Schema_RLS.md`. Open PR [#10](https://github.com/Shadesuk/Shadesuk-live/pull/10) adds `supabase/migrations/` (empty production tables + RLS). Storefront code on `main` does not query any table. |
| Authentication | **Missing as product.** Types reserve Google as optional (`src/types/integrations.ts`). No Auth UI, no middleware session gate, no account routes. Supabase Auth is only probed (`/auth/v1/health`). |
| Existing payment code | **Missing.** No Stripe/Razorpay SDK. `PaymentProvider` is a type stub (`id: "stripe" \| string`). |
| Existing shipping code | **Missing.** No carrier/address-provider implementation. `AddressLookupProvider` is a type stub. |
| Existing analytics | **Missing.** No event module, no `page_view` / ecommerce events, no third-party analytics package. |
| Environment variables | See §1.1. |

### 1.1 Environment variables (as documented)

From `.env.example` only. Real values are gitignored.

| Variable | Role | Present in example |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `metadataBase`, sitemap, robots. Local fallback `http://localhost:3000` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server publishable key (preferred) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy alias | Commented |
| `SUPABASE_SECRET_KEY` | Server-only secret (preferred) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy alias | Commented |

**Not present** (needed before later Phase 3 slices): payment secret/publishable keys, webhook secret, Google OAuth client IDs, Resend/API email keys, address-autocomplete provider keys, analytics IDs, any `STRIPE_*` / `RAZORPAY_*` names.

### 1.2 Architecture map (as implemented on `main`)

```text
Browser
  └── SiteChrome (header / footer / drawers)
        ├── Server pages (home, PLP, search, brands, collections)
        │     └── src/services/{catalogue,collections,search}
        │           └── src/data/catalogue.ts   ← demo fixtures only
        └── Client overlays (search, filters, mobile nav)
              └── same in-memory services (bundled into the client)

Supabase (optional, unlinked in this checkout)
  └── /api/health/supabase  (connectivity only; no schema reads)
```

There is **one** catalogue service and **one** collection template. That matches the handoff rule of one component system. It is **not** yet one production data model.

### 1.3 Scripts and quality gates

| Script | Role |
| --- | --- |
| `npm run dev` / `build` / `lint` | Standard Next scripts. No `test` script. |
| `scripts/verify-catalogue.ts` | Fixture integrity (demo flags, no invented photos/styles). |
| `scripts/verify-collections.ts` | Shared filter/sort/paging against fixtures. |
| `scripts/verify-discovery.ts` | Brand/collection hub rules. |
| `scripts/verify-search.ts` | Client search + typo correction against fixtures. |

These verifiers lock demo behaviour. They must not be treated as production tests.

---

## 2. Existing implementation status

Required surfaces from the Phase 3 handoff Section 5.

| Surface | Status | Evidence |
| --- | --- | --- |
| Homepage | **Partial** | Real approved module stack at `/` (`HeroCampaign`, featured, editorial, gender, best sellers, product story, shapes, new arrivals, trust, final CTA). Product rails are **Mocked** (demo catalogue). Campaign/editorial/gender media are **Hard-coded** placeholders (`MediaPlaceholder`). Product cards link to missing PDPs (**Broken** destinations). |
| Header | **Partial** | Locked desktop/mobile chrome: logo, Shop menu, New Arrivals, Best Sellers, Collections, About, Search, Account, Bag. Search overlay works. **Bag is a no-op.** Account and About resolve to missing routes. |
| Navigation | **Partial** | Primary nav, Shop mega-menu, mobile drawer with Gender / Brands / Shapes / Styles / Collections. Style submenu is a collections fallback (style taxonomy unpublished by design). Several destinations 404. |
| Search | **Partial** | Overlay + `/search` landing + results reuse CollectionTemplate / ProductGrid / FilterBar / SortControl. Debounced suggestions, recent searches, typo correction (`aviater` → aviator), no-results state. Engine is **Mocked**: in-memory over the 6 demo products, loaded into the browser. Not server search. |
| PLP | **Partial** | Shared `CollectionTemplate` for `/shop`, `/men`, `/women`, `/unisex`, `/new-arrivals`, `/best-sellers`. Filters (gender, brand, shape, colour, price, availability) with Apply drawer, URL state, chips, Clear all, Load more (`limit` query), empty/error/loading. Data is **Mocked**. Page size is **Hard-coded** (`COLLECTION_PAGE_SIZE = 4`). Counts are derived from fixtures (correct for demo, not live). |
| Collections | **Partial** | Hub `/collections` lists **populated shape collections only** (Aviator, Rectangle, Square, Round, Cat-Eye). `/collections/[slug]` reuses the PLP template. Unknown slugs 404. Style collections unpublished (intentional). Hub copy/structure is static; membership is demo-derived. |
| Brand pages | **Partial** | `/brands` index + `/brands/[slug]` on the same collection template; brand filter hidden on brand PLP. Brands are **Mocked** (`Demo Line A/B/C`). No logos or invented descriptions. Unknown slugs 404. |
| PDP | **Missing** | `productPath()` emits `/product/[slug]`. No `src/app/product/` route. Cards, product story, and search suggestions all navigate into a branded 404. No gallery, variants, Size & Face Guide, disclosure component, add-to-bag, or sticky purchase bar. |
| Cart | **Missing** | Route `/cart` defined in `routes` but no page. Header Bag button is an empty `onClick`. No cart service, drawer, persistence, or merge. |
| Checkout | **Missing** | No `/checkout` route, session, address UI, shipping step, or payment mount. |
| Account | **Missing** | `/account` linked from header and mobile nav; no page, no sign-in/register/Google/password-reset/orders/addresses. |
| Order tracking | **Missing** | `/track-order` linked from footer; no guest verification flow, no `/order/[secure-reference]`. |
| Footer | **Partial** | Locked groups (Shop / Help / Company) plus restrained social placeholder and “Secure card payment” line. Help and Company links mostly 404. |
| Legal pages | **Missing** | No `/about`, `/contact`, `/faq`, `/shipping-policy`, `/refund-policy`, `/terms`, `/privacy-policy`, `/cookie-policy`. Footer and sitemap spec require them. |
| Error states | **Partial** | Global branded 404; catalogue `error.tsx` (“We couldn’t load this collection.”); brand/collection not-found pages; search and filter empty states. No product-not-found PDP, no cart/checkout/payment/account errors, no search-service failure (search cannot fail independently of the page). |
| Loading states | **Partial** | Route-level `loading.tsx` + ProductGrid skeletons on known PLP/search routes. Button `loading` prop. No PDP/cart/checkout skeletons. Homepage has no route loading UI. |
| Responsive behaviour | **Partial** | Locked breakpoints in tokens (`<768` / `768–1199` / `1200+` / `1440+`). Product grid 2 / 3 / 4 columns. Header switches to mobile menu below 1200px. Search overlay is full-screen drawer on small screens, modal on desktop. Filters bottom sheet vs right drawer. **Not QA’d** against the handoff width matrix or missing purchase surfaces. |
| Accessibility | **Partial** | Skip link, `lang="en"`, visible focus, 44px touch token, labelled search, combobox suggestions, drawer/modal focus trap + Escape + restore, reduced-motion duration token, skip-link, `aria-live` product counts. Gaps: Bag control has `hasPopup="dialog"` but opens nothing; several icon-only patterns still use visible text (good); no WCAG 2.2 AA audit; no PDP/checkout forms to evaluate. |
| SEO | **Partial** | `metadataBase` from `NEXT_PUBLIC_SITE_URL`; title template; homepage `index/follow`; **root layout defaults to `index: false`**; `/search` noindex; `robots.ts` allows `/` and points at sitemap; sitemap currently emits **homepage only**. No canonicals beyond metadataBase, no product JSON-LD, no Open Graph, no per-collection sitemap entries. |
| Analytics | **Missing** | No event contract implementation. Recently viewed / recent search are local UX only, not analytics. |

### 2.1 Status roll-up

```text
Complete:     none of the required production surfaces (frontend chrome/PLP/search are real UI, but none are production-wired)
Partial:      Homepage, Header, Navigation, Search, PLP, Collections, Brand pages, Footer, Error states, Loading states, Responsive, Accessibility, SEO
Mocked:       Catalogue, search engine, merchandising flags, brand list, collection membership, homepage product rails
Hard-coded:   Editorial/campaign/gender placeholders; collection page size 4; trust/shipping copy; demo product names/prices/IDs (labelled demo)
Broken:       PDP links from cards/search/story; Bag button; Account / About / legal / track-order / contact / FAQ footer+header destinations
Missing:      PDP, Cart, Checkout, Account, Order tracking, Legal pages, Analytics, Payments, Shipping, Auth, Inventory, Orders, Fulfilment
```

No required customer-journey surface is **Complete** as a production system. The approved discovery frontend is substantially present and should be preserved.

---

## 3. Mocked, hard-coded, and missing areas

### 3.1 Mocked (explicit demo fixtures)

`src/data/catalogue.ts` is labelled:

> Demo catalogue fixtures. Not live inventory, not real brands, and not product photography.

| Item | Detail |
| --- | --- |
| Brands | `Demo Line A/B/C`, `isDemo: true`, no descriptions, no logos |
| Products | `Frame 01`–`Frame 06`, demo slugs/IDs |
| Prices | Product-level GBP numbers (`49`, `55`, `45`, `59`, `65`) — not server-authoritative, not minor units |
| Availability | Fixture enums `in_stock` / `out_of_stock` / `sold_out` (Frame 04 / 05) |
| Colours | Shared colour objects including unavailable Green |
| Images | Always `[]` — integrity script **forbids** invented `src` |
| Merchandising | `isNewArrival` / `isBestSeller` booleans on fixtures |
| Search | Full catalogue scanned in-process (and in the client bundle via ProductCard/SearchForm) |
| Homepage rails | `getHomepageFeatured(4)` = first four fixtures; best sellers / new arrivals filtered from the same set |
| Recently viewed | Session IDs resolved against the same fixture list |

Integrity guard: `assertDemoCatalogueIntegrity()` runs on the homepage and in `verify-catalogue.ts`. Demo rows must stay `isDemo`, must not invent photography, styles, brand copy, or logos.

### 3.2 Hard-coded (allowed vs not allowed)

**Allowed as static design/content (keep):**

- Brand name/description in `src/lib/site.ts`
- Header/footer IA labels and routes in `src/lib/navigation.ts`
- Homepage editorial headlines (“Shades for every angle.”, “Find your frame.”)
- Trust copy: “International shipping. Delivery is expected to take a minimum of 2 weeks.” / “Secure card payments.” / “Every order can be tracked.”
- Media placeholder labels until real assets exist
- Locked shape list (Aviator, Rectangle, Square, Round, Cat-Eye)
- Locked breakpoints, tokens, Inter

**Not allowed as production operational data (must become data-driven):**

- Product names, prices, IDs, slugs
- Brand records and product counts
- Colour counts (`getColourCount` uses `product.colours.length`, including unavailable Green — conflicts with the handoff rule that PLP colour count must match selectable variants)
- Availability / sold-out
- Collection membership and “N shades” counts
- `COLLECTION_PAGE_SIZE = 4` (demo paging, not a catalogue page size)
- Sort option `best-selling` currently sorts by the fixture boolean, not sales

### 3.3 Missing (blocks Phase 3.4+)

| Area | Missing pieces |
| --- | --- |
| Routes | `/product/[slug]`, `/cart`, `/checkout`, `/account`, `/track-order`, `/order/[secure-reference]`, all legal/help pages listed in `sitemap.md` |
| PDP | Gallery, variant/colour/size selection, measurements (omit if absent), Size & Face Guide, disclosure component, add-to-bag states, related/recently viewed on PDP, unavailable state |
| Cart | Guest + account persistence, bag drawer, quantity, revalidation, merge |
| Checkout | Guest flow, customer details, address autocomplete abstraction + manual fallback, shipping, payment, expiry/recovery |
| Payments | Provider session, webhooks, idempotency, refunds (provider itself is conflicted — see §6) |
| Orders | Idempotent creation, snapshots, status model, confirmation |
| Inventory | Server-authoritative stock; variant identity; no client trust |
| Fulfilment | Supplier mapping, carrier abstraction; schema V1 is manual (conflict — §6) |
| Auth | Email/password, Google, reset, session, RLS-backed profile/addresses |
| Search backend | Server search, cancellation, no full-catalogue browser load |
| Recommendations | Modules exist only as homepage merchandising filters; no “You May Also Like” / “Recommended for You” |
| Analytics | Entire event contract |
| SEO wiring | Product/collection/brand sitemap entries, structured data, indexation policy for filters |
| Email | No Resend (or other) integration in app code |
| Admin | No operator UI |
| Tests | No PA/regression suite; only fixture verify scripts |

### 3.4 Broken destinations (do not treat as “complete chrome”)

These controls are implemented as UI but fail the customer journey:

1. **Bag** — `SiteHeader` UtilityButton `onClick` is empty (`/* Bag drawer is a later phase. */`), yet `hasPopup="dialog"`.
2. **Product links** — every ProductCard, search product suggestion, and Product Story CTA goes to `/product/[slug]` → 404.
3. **Account** — header + mobile nav → `/account` → 404.
4. **About** — primary nav + footer → `/about` → 404.
5. **Footer Help/Company** — FAQ, Contact, Shipping, Returns, Track Order, Terms, Privacy, Cookie → 404.

Preserving approved chrome means **wiring these destinations**, not replacing the header/footer.

---

## 4. Specification inventory

### 4.1 Mandatory Phase 3 references (handoff §2)

| File | In repo? | Notes |
| --- | --- | --- |
| `Development Roadmap.txt` | **No** | Required by the handoff. Not on `main`. Payment-provider and fulfilment intent cannot be confirmed from this file. |
| `brand_design.md` | Yes | Locked palette, type, restraint. Implemented in tokens. |
| `homepage.md` | Yes | Module order implemented; media still placeholders. |
| `sitemap.md` | Yes | IA implemented in `routes`; many routes unwired. Specifies **Stripe** for later payment UI. |
| `search.md` | Yes | Overlay/results architecture implemented on demo data. |
| `plp.md` | Yes | Shared template/filters/sort/load more implemented. |
| `pdp.md` | Yes | **No matching implementation.** |
| `collections_discovery.md` | Yes | Hub + shape collections; styles unpublished. |
| `global_components_ui_states.md` | Yes | Button/Drawer/Modal/EmptyState/ProductCard exist; checkout/account/payment components do not. |
| `responsive_accessibility.md` | Yes | Tokens and chrome follow it; full QA not done. |
| `cart_checkout.md` | Yes | **No matching implementation.** |
| `account_order_tracking.md` | Yes | **No matching implementation.** |
| `seo_performance.md` | Yes | Partial metadata/robots/images config only. |
| `SKILL (1).md` | Yes | Impeccable skill spec. Not executed in this audit run (no visual implementation). |

### 4.2 Additional repo specs (relevant, not in the §2 list)

| File | Role |
| --- | --- |
| `SHADESUK — UI-UX Specification.md` | Broader locked UX. |
| `SHADESUK_Database_Schema_RLS.md` | Locked DB/RLS production foundation. Specifies **Razorpay**, **Resend**, **manual V1 fulfilment**. |
| `DESIGN.md` / `PRODUCT.md` | Impeccable context. `PRODUCT.md` still says homepage/search/cart are “out of scope for later phases” — **stale** relative to shipped frontend. |
| `README.md` | Scaffold + Supabase connection instructions. |
| `responsive_accessibility (1).md` | **Duplicate** of `responsive_accessibility.md` (identical). |

### 4.3 Spec vs code — locked decisions already obeyed

- Product-first editorial commerce, navy/off-white/stone/near-black/white, Inter only.
- Guest checkout required by spec; account optional; Google convenience-only (not built).
- Shared ProductCard / ProductGrid / FilterBar / SortControl across PLP, search, brand.
- Style taxonomy unpublished until data exists (no invented Classic/Sport).
- Demo catalogue must not invent photography, reviews, scarcity, or brand stories.
- Minimum 2-week shipping expectation is present in TrustSection.
- PDP disclosure wording is specified as a **frontend component**, not per-product CMS copy — schema currently stores a default string on `products.disclosure` (conflict, §6).

---

## 5. Route inventory vs sitemap spec

| Route (from `sitemap.md` / `routes`) | Implementation on `main` |
| --- | --- |
| `/` | Homepage (demo data) |
| `/shop` `/men` `/women` `/unisex` `/new-arrivals` `/best-sellers` | PLP template |
| `/collections` `/collections/[slug]` | Hub + shape PLPs; unknown 404 |
| `/brands` `/brands/[slug]` | Index + brand PLP; unknown 404 |
| `/search` | Landing + results (noindex) |
| `/product/[slug]` | **Missing** (404) |
| `/cart` `/checkout` `/account` `/track-order` `/order/[secure-reference]` | **Missing** |
| `/about` `/contact` `/faq` and policy URLs | **Missing** |
| `/api/health/supabase` | Present (not a storefront route) |
| `/sitemap.xml` `/robots.txt` | Present; sitemap is homepage-only |

Direct refresh works for implemented App Router pages. Dynamic product/checkout/account deep links cannot work until those routes exist.

---

## 6. Genuine technical conflicts (do not silently pick)

These are conflicts between locked documents and/or between documents and the current code. Phase 3 must report them before wiring.

### 6.1 Payment provider — Stripe vs Razorpay

| Source | Says |
| --- | --- |
| Phase 3 handoff §19 | “Current roadmap specifies **Stripe**.” |
| `sitemap.md` | “**Stripe** payment UI will be integrated later.” |
| `src/types/integrations.ts` | `PaymentProvider.id: "stripe" \| string` |
| `SHADESUK_Database_Schema_RLS.md` | Architecture + webhooks + secrets named **Razorpay** |
| Open PR #10 schema | `payments.provider` is unconstrained `text` (can store either), but the spec it implements is Razorpay-oriented |

**Impact:** Env vars, webhook verification, frontend payment mount, and idempotency all depend on this. Do not add a second provider “just in case.” Resolve against the missing `Development Roadmap.txt` plus current commercial choice, then implement one abstraction.

### 6.2 Fulfilment model — supplier chain vs manual V1

| Source | Says |
| --- | --- |
| Phase 3 handoff §27–30 | China-origin supplier mapping, carrier abstraction, Royal Mail as last-mile possibility — architecture must not assume a UK warehouse. |
| `SHADESUK_Database_Schema_RLS.md` §1 | **V1 = manual fulfil and ship.** No supplier API, carrier API, or Royal Mail API required. Tables: `shipments` + `tracking_events` with manual carrier/AWB/URL. |
| PR #10 | Matches the schema spec (manual shipments). No `suppliers` / SKU-mapping tables. |

**Impact:** Frontend tracking UI can still consume shipment/status fields. Supplier mapping is **not** in the current schema. If Phase 3 requires supplier architecture now, that is a schema extension; if V1 stays manual, the handoff’s supplier slices should be marked deferred rather than faked.

### 6.3 Frontend catalogue contract vs database contract

Frontend `Product` (`src/types/catalogue.ts`) vs schema `products` / `product_variants`:

| Concern | Frontend (approved storefront types) | Schema / PR #10 |
| --- | --- | --- |
| Brand | `brands` records + `brandId` | `products.brand` **text**, no brands table |
| Gender / shape | Arrays (`gender[]`, `shape[]`) | Single `text` columns |
| Price | Product-level `price: number` (major units) | Variant-level `price_minor` integer |
| Colours | `ProductColour[]` with ids/slugs/hex/availability | `product_variants.colour_name` text |
| Variants | Optional `variants?: ProductVariant[]`; demo products omit them | Required purchasable row with SKU + stock |
| Merchandising | `isNewArrival`, `isBestSeller` | **No columns** |
| Images | Roles: front/side/detail/back/temple/on-model/packaging | Types: primary/secondary/detail/side/lifestyle |
| Disclosure | Handoff: reusable PDP component, not product data | `products.disclosure` NOT NULL default |
| Collections | Code-defined gender/shape/merch + `product_collections` later | `collections` + `product_collections` only |

**Impact:** Phase 3.3 must define an anti-corruption mapping. Do not reshape the approved ProductCard/PLP UI to match SQL column-for-column. Do not invent brands, measurements, or merchandising flags that the database does not have.

### 6.4 Guest cart vs RLS on the open schema PR

PR #10 `carts` supports `session_id` XOR `user_id`, but customer RLS policies are **authenticated-only** (`user_id = auth.uid()`). Anon grants are not given on `carts` / `cart_items`.

**Impact:** Guest cart on the storefront cannot be a direct anon Supabase client write against those policies. Guest persistence will need a server-mediated session (cookies + service role or a dedicated RPC) in 3.6. Do not “fix” this by opening anon writes.

### 6.5 Naming collision — two “Phase 3”s

Git history Phase 3 (`cursor/phase-3-catalogue-foundation-04ba`, PR #3) is **catalogue UI fixtures**. This handoff Phase 3 is **production integration**. Later PRs should say “Phase 3 production” or use the 3.x slice numbers to avoid merging the wrong checklist.

### 6.6 Missing roadmap file

The handoff lists `Development Roadmap.txt` as mandatory. It is not in the repository. Stripe-vs-Razorpay and supplier-vs-manual fulfilment cannot be closed from repo files alone.

---

## 7. Related work not on `main`

| Item | State | Relevance |
| --- | --- | --- |
| [PR #10](https://github.com/Shadesuk/Shadesuk-live/pull/10) `cursor/initial-production-schema-e3d9` | Open, unmerged | Adds `supabase/migrations/` (18 tables, RLS). PR body states migrations were applied to the linked Supabase project with **zero application rows**. Storefront still does not read them. |
| Frontend PRs #1–#8 | Merged | Scaffold, chrome, catalogue card/grid, PLP, homepage, search, brands/collections. Preserve these. |
| PR #9 | Merged | Supabase clients + health check. Preserve these. |

This audit does **not** treat PR #10 as the live storefront contract until it is merged and mapped through 3.3.

---

## 8. What to preserve

Do not rebuild:

- Token system, Inter, layout primitives
- Header / Shop menu / mobile drawer / footer structure
- ProductCard, ProductGrid, Load More
- CollectionTemplate, FilterBar, FilterDrawer, SortControl, ProductCount
- Search overlay/landing and shared results template
- Homepage module sequence
- Demo integrity rules (no fake photos, styles, brand copy)
- Supabase client split (browser / server / admin) and health route

Do not introduce a second card, filter, or checkout visual language.

---

## 9. Gaps that block Phase 3.2+

Ordered by how badly they stop the locked 3.x sequence.

1. **No production data plane on `main`.** Catalogue services read fixtures. Supabase is connectivity-only. Schema lives in an unmerged PR / empty remote tables.
2. **Unresolved provider conflicts** (Stripe vs Razorpay; manual fulfilment vs supplier chain; missing `Development Roadmap.txt`).
3. **Frontend `Product` type is not the database product.** Variant identity, minor-unit prices, brands, merchandising flags, and colour counts will be wrong if 3.4 starts against fixtures or against raw SQL.
4. **PDP does not exist**, but the whole discovery UI already links to it. Add-to-bag, inventory, and cart cannot start.
5. **No env surface for payment, auth, email, address, or analytics.**
6. **Guest cart has no application session and the drafted RLS does not allow anon cart writes.**
7. **Search and ProductCard import demo services into the client bundle** — incompatible with “do not load the entire catalogue into the browser.”
8. **Bag / Account / legal / tracking controls are present and 404 or no-op** — journey is already advertised in chrome.

---

## 10. Recommended next slice

**3.2 Environment / configuration audit is the companion document:** [`docs/PHASE3_ENV_CONFIG_AUDIT.md`](./PHASE3_ENV_CONFIG_AUDIT.md).

Do not start 3.3 until Syed locks the provider/schema decisions listed there. 3.3 is the first **code-shaping** slice; 3.2 is the gate that stops that slice from encoding the wrong provider and the wrong database.

Security constraints that 3.3+ must obey are in **§12**. They are documentation of current `main`, not a licence to start wiring.

---

## 11. Audit checklist (Section 5)

- [x] Existing stack (framework, language, package manager, build, routing, styling, components, state, data-fetching, backend, database, auth, payments, shipping, analytics, env)
- [x] Implementation status for every listed surface
- [x] Mocked / hard-coded / missing / broken called out
- [x] Relevant `.md` spec inventory
- [x] Architecture conflicts reported, not silently resolved
- [x] Security appendix (handoff §63 / §64) against current `main`
- [x] No backend wiring or feature implementation in this slice
- [x] Approved frontend preserved
- [x] No invented catalogue facts

---

## 12. Security appendix (handoff §63 / §64)

**Against:** current `main` (`a79678e`) plus the unmerged schema in [PR #10](https://github.com/Shadesuk/Shadesuk-live/pull/10) where noted.  
**Not against:** a production-wired storefront. Most §63 rows are **N/A** because the feature does not exist yet; that is still a finding for later slices.

Vocabulary for this appendix:

| Result | Meaning |
| --- | --- |
| **PASS** | Required control exists on `main` for the surface that exists today. |
| **FAIL** | Required control is missing or wrong on a surface that already exists. |
| **N/A** | Surface is not implemented; the control cannot pass or fail yet. Treat as a **hard requirement** before that surface ships. |
| **HIGH (cutover)** | Acceptable on demo fixtures; must be fixed before live catalogue/payment data. |

### 12.1 Handoff §63 checklist (current `main`)

| Control | Result | Evidence |
| --- | --- | --- |
| Secrets are server-side | **PASS** (current surface) | `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are non-`NEXT_PUBLIC_`. `admin.ts` is `server-only`. `.gitignore` ignores `.env*` except `.env.example`. |
| No secret keys in frontend bundle | **PASS** (current surface) | Secret is never read from a Client Component. Publishable/anon keys are public by design. **Not proven by a production bundle scan in this docs slice.** |
| Payment secrets protected | **N/A** | No Stripe/Razorpay SDK, no payment env names in `.env.example` or app code. When a provider is locked, secret and webhook keys must stay server-only. |
| Webhooks verified | **N/A** | No webhook Route Handler. PR #10 has `payment_webhook_events`; verification is not implemented. See §12.7. |
| Authentication sessions secure | **N/A** | No Auth UI, no `middleware.ts`, no cookie session gate. Server client can attach cookies when auth exists. See §12.5. |
| Authorisation checked server-side | **N/A** | No customer/admin application endpoints. PR #10 RLS is authenticated-or-admin; storefront does not query it. |
| Customer data scoped correctly | **N/A** | No customer records (`auth.users` = 0). Required before account/orders. |
| Guest tracking protected | **N/A** | No `/track-order` or `/order/[…]`. Required before that route ships. See §12.3. |
| Admin endpoints protected | **N/A** | No admin UI or admin API. `admin_users` + `private.is_admin()` exist only in PR #10 schema. |
| Input validation present | **PARTIAL / N/A** | Catalogue query parsing exists for demo PLP/search. No payment/order/auth input validation. |
| Output sanitised where necessary | **PASS** (current surface) | Health responses omit keys and upstream bodies. No user-generated HTML rendering. |
| Rate limiting where appropriate | **FAIL** (health) / **N/A** (auth, tracking, payment) | Unauthenticated `GET /api/health/supabase` has no rate limit. Auth, guest tracking, and webhooks will need limits when those routes exist. |
| Sensitive errors not exposed | **PASS** (production health) / **PARTIAL** (development health) | Production health returns `{ ok, checkedAt }` only. Development returns probe statuses and **variable names** (not values). Catalogue `error.tsx` is generic. |
| Logs do not contain unnecessary sensitive data | **PASS** (current surface) | Production health logs issues/warnings/probes, not keys. No payment/PII logging yet. |

### 12.2 Hard rule — admin client / service-role

**Rule (locked for all later slices):**

> No unauthenticated Route Handler may return data sourced via `createSupabaseAdminClient` / service-role.

On current `main`:

- `createSupabaseAdminClient()` is defined and unused by any Route Handler.
- The only Route Handler is `GET /api/health/supabase`.
- Health **does** call `getSupabaseSecretKey()` from `health.ts` to probe `/rest/v1/` with the secret as `apikey`. That is a **connectivity probe**, not a schema read, and the response never includes key material or PostgREST bodies.
- Health is still **unauthenticated**. It must not grow into “run an admin query and return rows.”

**Allowed later:** webhook handlers and trusted server jobs may use the admin client after verifying the caller (webhook signature, cron secret, or equivalent). They must not become public GETs.

**Not allowed later:** guest cart, guest tracking, or catalogue APIs that bypass RLS by using service-role and then returning that data to anyone who hits the URL.

PR #10 guest carts already require server mediation (RLS is authenticated-only). That mediation must not be an unauthenticated admin-client leak.

### 12.3 Guest order tracking (handoff §64)

**Required before `/track-order` or order URLs ship:**

```text
TRACK ORDER
→ Order reference (non-guessable)
+ Required verification (e.g. email)
→ Server-side lookup
→ Minimal order response
```

**Forbidden:**

```text
/order/12345
```

revealing an order because the id/reference is guessable.

On current `main`: **N/A** — `routes.trackOrder` is `/track-order`; footer links to it; **no page**. No `/order/[secure-reference]`. PR #10 `orders.order_reference` is unique text with no format constraint in SQL. 3.3 must specify a non-guessable reference scheme and a verification field; 3.13 must enforce it server-side with rate limiting.

Do not use sequential integers, SKUs, or payment provider ids as the public lookup key.

### 12.4 Health oracle — `GET /api/health/supabase`

Unauthenticated by design (PR #9).

| Environment | Body | Status |
| --- | --- | --- |
| Production (`NODE_ENV=production`) | `{ ok, checkedAt }` | 200 / 503 |
| Development | Full report: `configured`, `issues`, `warnings`, `probes` (variable **names**, never values) | 200 / 503 |

**Why it is still an oracle:** anyone can learn whether this deployment’s Supabase URL/keys currently authenticate, and can probe that over time (outage, key rotation, misconfig). Production redaction is **PASS** for secret leakage. Absence of auth and rate limiting is **FAIL** against a hardened production bar.

Do not add schema, table lists, or admin-query results to this endpoint. Optional later hardening (not this docs slice): network restriction, shared-secret header, or removing the public route from production.

### 12.5 Middleware / session gate

There is **no** `src/middleware.ts`.

`createSupabaseServerClient()` comments that session refresh must happen in a Route Handler, Server Action, or middleware. None of those auth refresh paths exist.

Before `/account` or any authenticated API ships:

1. Add middleware (or equivalent) that refreshes the Supabase session on matching routes.
2. Gate `/account/**` on a real session; unauthenticated users see the approved sign-in UI, not another customer’s data.
3. Do not rely on client-only redirects as authorisation.
4. Guest checkout must keep working without a session.

Current header Account control 404s. That is a missing page, not a session leak.

### 12.6 Client-bundle catalogue — **High at live-catalogue cutover**

Demo search/PLP load the in-memory catalogue into Client Components:

| Client module | Imports |
| --- | --- |
| `ProductCard` | `@/services/catalogue` (same module as `getProducts()` → `demoCatalogue`) |
| `SearchForm` | `@/services/search` → `getProducts()` |
| `ShopMenu` / `MobileNavDrawer` | `getMenuBrandLinks()` from catalogue |
| `SearchOverlay` / `SearchLanding` | search discovery helpers |

**Today:** fixtures are six demo frames, labelled `isDemo`. Acceptable for the approved frontend.

**At live-catalogue cutover (before 3.4 ships real rows):** **HIGH**. Handoff §39: do not load the entire product catalogue into the browser.

**Required before live data:**

- Server search (RSC / Route Handler), with debounce and cancellation already specified.
- ProductCard must receive product **props** from the server; it must not import the catalogue module that reads all products.
- Brand/menu links from a small server-provided list, not `getProducts()`.

Do not “fix” this by adding a second product-card system.

### 12.7 Payment webhook trust

Handoff §19 / §22 / §108: the frontend must not declare an order paid because the customer returned from a payment page. Paid state comes from **verified provider webhook or equivalent server confirmation**.

On current `main`: **N/A** — no payment code.

When 3.9 exists:

- Verify signatures with a **server-only** webhook secret.
- Persist provider event ids in `payment_webhook_events` (PR #10) and process idempotently.
- Map provider events onto `payments.status`; never trust `?success=true` query params.
- Do not put webhook secrets on `NEXT_PUBLIC_`.
- Provider choice (Stripe vs Razorpay) is **not** locked here. See the 3.2 env audit.

### 12.8 Security implications for 3.2 / 3.3

- Env inventory and provider lock-ins: [`docs/PHASE3_ENV_CONFIG_AUDIT.md`](./PHASE3_ENV_CONFIG_AUDIT.md).
- 3.3 data contracts must include non-guessable `order_reference`, guest-tracking verification, and “paid only after verified webhook.”
- Do not open anon RLS writes on `carts` to make guests work.
- Do not invent a second payment provider “just in case.”

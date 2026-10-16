# SHADESUK Admin V1 — Step 1 audit

**Phase:** Admin V1 / Step 1 — Audit only  
**Status:** Complete (inspect and document; no AdminShell, routes, or features).  
**Audited commit:** `ee74f80` on `main` (“Follow-up: keep sticky PDP CTA in sync while scrolling”, [#24](https://github.com/Shadesuk/Shadesuk-live/pull/24))  
**Default branch:** `main`  
**Repository:** https://github.com/Shadesuk/Shadesuk-live  
**Date:** 16 September 2026  
**Authority:** Admin V1 Master Implementation Handoff wins over older docs where they conflict. Storefront CSS tokens/modules win over the handoff’s Tailwind mention.

This is the Step 1 deliverable of the Admin V1 handoff (§60 / §63). It does not implement `/admin`, mutate schema, or rebuild the storefront. Genuine gaps are reported rather than invented.

Companion: [`docs/ADMIN_V1_SECURITY.md`](./ADMIN_V1_SECURITY.md).

**Ignored:** [#22](https://github.com/Shadesuk/Shadesuk-live/pull/22) (open storefront polish, not on `main`). Storefront Phase 3 already shipped on `main` via [#10](https://github.com/Shadesuk/Shadesuk-live/pull/10)–[#21](https://github.com/Shadesuk/Shadesuk-live/pull/21), [#23](https://github.com/Shadesuk/Shadesuk-live/pull/23), [#24](https://github.com/Shadesuk/Shadesuk-live/pull/24).

**Live backend inspected:** Supabase project **Shadeslive** (`eu-central-1`, Postgres 17; project ref is the subdomain of `NEXT_PUBLIC_SUPABASE_URL`, documented in PR #9 / README — not repeated here). Applied migrations match git: `20260914230750_initial_production_schema`, `20260914231056_optimize_foundation_indexes_and_rls`. Security advisor: clean. Application tables: **0 rows**. Auth users: **0**. Storage buckets: **none**.

---

## 0. How to read this document

| Class | Meaning |
| --- | --- |
| **BLOCKING** | Must be locked or fixed before the named Admin step can be considered production-safe. Do not silently invent a workaround. |
| **NON-BLOCKING** | Real finding. Does not stop the named step if handled honestly. |
| **DEFERRED** | Out of Admin V1 because of an explicit lock (payments, carrier APIs, CMS builders, discounts). |
| **READY** | Existing schema/contract/UI can support the Admin V1 behaviour without a new table. |

Frontend storefront phases used a different numbering scheme. This document uses “Admin V1 Step *n*” only in the handoff sense.

---

## 1. Existing architecture

| Layer | Finding |
| --- | --- |
| Framework | Next.js `16.3.4` App Router (`src/app`). Next 16 **Proxy** (`src/proxy.ts`) is the session-refresh equivalent of middleware. There is **no** `middleware.ts`. |
| Language | TypeScript `^5`, `strict: true`. Path alias `@/*` → `src/*`. |
| UI | React `19.2.8`. **No Tailwind. No CSS-in-JS.** Global tokens (`src/styles/tokens.css`) + CSS Modules. Inter via `next/font/google`. |
| Package manager | npm (`package-lock.json`). |
| Routing | File-system routes. Catalogue under `src/app/(catalogue)/`. Info/legal under `src/app/(info)/`. Account, cart, checkout, product, track-order are top-level. **No `/admin` segment.** |
| Root chrome | `src/app/layout.tsx` wraps **every** page in storefront `SiteChrome` (header, footer, bag drawer, search, analytics beacon) and prefetches the public cart + catalogue. Checkout only *reduces* chrome; it does not remove it. |
| State | No Redux/Zustand. Server Components + Server Actions. Client state is local React plus a few cookies/`sessionStorage` keys. |
| Data | `src/services/*` + `src/contracts/*`. Live catalogue uses the **publishable/anon** key + RLS. Guest cart merge and guest tracking use the **server-only** service-role client. |
| Auth | Supabase Auth. Email/password, password reset, optional Google (dashboard-pending). Account gates call `getUser()` on the server (`src/lib/account-session.ts`). Proxy matcher is only `/account/:path*` and `/auth/:path*`. |
| Payments | **Not implemented.** `src/contracts/payment/stub.ts` maps schema `payment_status` to customer copy. Checkout review CTA is disabled. **No orders are written.** |
| Analytics | Provider-agnostic storefront event bus (`src/lib/analytics.ts`). No-ops until a provider is registered. **Not** an Admin metrics source. |
| Tests | No `test` script. Contract/storefront verifiers under `scripts/verify-*.ts`. |

### 1.1 Supabase clients (do not confuse names)

`src/lib/supabase/admin.ts` is **not** the Admin dashboard. It is the service-role client (`server-only`, `SUPABASE_SECRET_KEY` / legacy `SUPABASE_SERVICE_ROLE_KEY`).

| Module | Context | Key | RLS |
| --- | --- | --- | --- |
| `src/lib/supabase/client.ts` | Client Components | publishable / anon | Yes |
| `src/lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers | publishable / anon + cookies | Yes |
| `src/lib/supabase/public.ts` | Cookie-less public catalogue reads | publishable / anon | Yes |
| `src/lib/supabase/admin.ts` | Trusted server work only | secret / service_role | **Bypassed** |

Admin V1 mutations must use the **cookie-bound server client** so RLS remains the third authorisation layer. Service-role is already used for guest cart and guest tracking; do not extend that pattern to staff CRUD.

### 1.2 Contracts (`src/contracts/`)

Canonical TypeScript shapes matching PR #10. Import from `@/contracts`.

| Area | Files | Notes |
| --- | --- | --- |
| Money | `money.ts` | Integer **minor units** in the database. `majorToMinorGbp` / `minorToMajorGbp`. Never persist floats. |
| Catalogue | `catalogue/schema.ts`, `map-product.ts`, `availability.ts`, `image.ts`, `merchandising.ts`, `taxonomy.ts`, `brand.ts`, `colour.ts` | Storefront mapper **drops** any product whose `status !== "published"`. |
| Cart | `cart/schema.ts`, `dto.ts`, `session.ts` | Guest XOR user ownership. |
| Order | `order/schema.ts`, `status.ts`, `dto.ts`, `reference.ts`, `tracking.ts` | Customer status labels match the handoff. Legal transitions are encoded. |
| Fulfilment | `fulfilment/shipment.ts` | Manual V1. Carrier is a string. `isManualFulfilmentV1()` is locked `true`. |
| Payment | `payment/stub.ts` | Display mapping only. Provider unset. |

There are **no generated database types** (`database.ts`). Admin code should keep using these contracts, not invent parallel DTOs.

### 1.3 Migrations

```text
supabase/migrations/
  20260914230750_initial_production_schema.sql
  20260914231056_optimize_foundation_indexes_and_rls.sql
```

README still says the CLI is not linked and migrations must not be run casually from this checkout. Live Shadeslive already has both migrations applied. The repo has **no** `supabase/config.toml`, **no** storage bucket SQL, **no** seed.

### 1.4 Architecture map (as implemented on `main`)

```text
Browser
  └── SiteChrome (header / footer / bag / search)
        ├── Storefront Server Components
        │     └── services/{storefront-catalogue, live-catalogue, search, …}
        │           └── publishable client + RLS (published rows only)
        ├── Account (getUser + profiles/addresses RLS)
        ├── Cart / checkout shell (cookie HMAC; payment CTA disabled)
        └── Guest tracking (service-role lookup after reference+email verify)

Supabase (Shadeslive)
  ├── public.*  (18 tables, RLS on, 0 rows)
  ├── private.is_admin()  (security definer; role = 'admin' only)
  └── storage.buckets  (empty)
```

There is **no** Admin lane.

---

## 2. Existing `/admin` code

**None.**

| Probe | Result |
| --- | --- |
| `src/app/admin/**` | Missing |
| `routes.admin` in `src/lib/navigation.ts` | Missing |
| Proxy matcher `/admin` | Missing |
| `ROBOTS_DISALLOW` `/admin` | Missing (`src/lib/seo.ts` lists search/account/checkout/cart/track-order/api/auth only) |
| `admin_users` reads in app code | Unused (account docs explicitly: “Admin dashboard — not built; `admin_users` is unused”) |
| UI named AdminShell / AdminSidebar / … | Missing |

The only `admin` identifier in application code is the **service-role client** filename. Treat that as a naming hazard for Step 2, not as an existing dashboard.

Unauthenticated visit to `/admin` today: branded storefront 404 inside `SiteChrome`.

---

## 3. Reusable UI primitives vs AdminShell

Admin is an operational tool. It must **not** look like the storefront and must **not** inherit merchandising chrome. Reuse primitives; do not reuse `SiteChrome`.

### 3.1 Reuse (with Admin-specific CSS Modules)

| Primitive | Path | AdminShell use |
| --- | --- | --- |
| Design tokens | `src/styles/tokens.css` | Colour, type, space, breakpoints (`768` / `1200` / `1440`), 44px touch, focus, reduced-motion duration. |
| `Button` / `ButtonLink` | `src/components/ui/` | Primary / secondary / tertiary + `loading`. |
| `Field` / `FieldSelect` | `src/components/ui/Field.tsx` | Labelled inputs, `aria-invalid`, error/hint. |
| `Modal` | `src/components/ui/Modal.tsx` | Focus trap, Escape, overlay click, scroll lock. Confirm-delete later. |
| `Drawer` | `src/components/ui/Drawer.tsx` | `side: left \| right \| bottom \| full`. Mobile nav drawer. |
| `EmptyState` / `ErrorState` / `InlineError` | `src/components/ui/` | Empty / error / retry copy. |
| `RouteLoading` / `RouteError` | `src/components/ui/` | Route-level states. |
| Focus trap / scroll lock | `src/hooks/useFocusTrap.ts`, `useScrollLock.ts` | Already used by Modal/Drawer. |
| `cx` | `src/lib/cx.ts` | Class merging. |
| `formatGbp` / money helpers | `src/lib/money.ts`, `@/contracts` | Display only; persist minor units. |
| `privatePathMetadata` | `src/lib/seo.ts` | `/admin` must stay noindex. |
| Account session helpers | `src/lib/account-session.ts` | Pattern to copy (`getUser()`, never `getSession()` alone). **Do not** reuse `requireAccountUser()` (it redirects to customer `/account`). |
| Sign-in form (optional) | `src/components/account/SignInForm.tsx` | Same Auth API. Restyle if used on `/admin`; do not drop staff into the customer account overview. |

### 3.2 Do not reuse as the Admin shell

| Piece | Why |
| --- | --- |
| `SiteChrome` / `SiteHeader` / `SiteFooter` / `BagDrawer` / `SearchOverlay` / `ShopMenu` | Customer merchandising chrome. Root layout currently forces this onto every route. |
| `PageContainer` / `ContentWidth` storefront widths | 67.5rem content max and marketing gutters are wrong for a dense ops layout. |
| Discovery `FilterBar` / `CollectionTemplate` / `ProductGrid` | Catalogue shopping UX, not an ops table. |
| Storefront `SearchInput` | Labelled “Search shades”; wired to catalogue search. |

### 3.3 Missing Admin foundation (build in later steps, not Step 2 feature creep)

Handoff §59 list vs repo:

| Needed | Exists? | First needed in |
| --- | --- | --- |
| AdminShell / Sidebar / Topbar / MobileDrawer | **No** | Step 2 |
| PageHeader / PageSection | **No** | Step 2 (minimal) |
| DataTable / DataList / Pagination / FilterBar (ops) / StatusBadge | **No** | Step 3–4 |
| MetricCard / TrendChart / RecentOrders / AlertList | **No** | Step 3 |
| ProductForm / VariantManager / InventoryEditor / media | **No** | Step 5 |
| OrderTable / OrderDetail / FulfilmentPanel / TrackingForm | **No** | Step 4 |
| CustomerTable / CustomerDetail | **No** | Step 7 |
| CollectionForm | **No** | Step 6 |
| ConfirmDialog / Toast | **No** (`Modal` can back ConfirmDialog) | Step 5 |
| LoadingState / EmptyState / ErrorState | Empty/Error **yes**; table skeletons **no** | Step 2+ |

**Styling decision (locked for this audit):** do **not** add Tailwind. Admin CSS Modules on the existing token sheet. The handoff’s “Tailwind” line is a conflict; the existing design system wins (§7.1).

---

## 4. Schema readiness

Live enums and tables match git migrations. **0 application rows.** Admin will be how the catalogue is populated; dashboard metrics will be honestly empty until paid orders exist.

### 4.1 Products / variants / images / inventory / pricing / sale — **READY with gaps**

| Handoff need | Schema | Verdict |
| --- | --- | --- |
| Name, slug, brand, description, materials, what's included, shape, gender, fit, disclosure | `products.*` | **READY.** Disclosure defaults to `High-quality 1:1 Superclone`. Storefront still ignores DB disclosure (global PDP component) until legal review. |
| Status | `catalogue_status`: `draft`, `published`, `archived` | **GAP:** no `unpublished`. Storefront visibility is `status = published` only. Unpublish can be implemented as `draft` (lossy) or a new enum value (Syed lock-in, §8 Q3). |
| Pricing / sale | Variant `price_minor` + nullable `compare_at_price_minor`; check `compare_at >= price`; GBP only | **READY.** Sale/slashed = `price_minor` with `compare_at_price_minor` as the struck regular. Matches PDP `compareAtPrice`. Integer minor units. |
| Variants | `product_variants`: colour, size, SKU unique, stock, status `draft \| available \| unavailable \| archived` | **READY.** Unique `(product_id, colour_name, size_name)`. |
| Inventory | `stock_quantity` on the variant (no separate inventory table) | **READY** for edit. **GAP:** no `low_stock_threshold` column. Alerts need a constant or Settings value (Syed lock-in, §8 Q5). |
| Images | `product_images`: `storage_path`, `alt_text`, `sort_order`, `image_type`, optional `variant_id`, generated `is_primary` | **READY** as rows. **NOT READY** as an upload pipeline (no buckets, no width/height, no derivative job). See §6. |
| Collections membership | `product_collections` M2M | **READY** as data. Storefront consumption is limited (see §4.2). |

Product delete FKs (destructive policy):

- `order_items.product_id` → `products.id` **ON DELETE RESTRICT** — products with order history cannot be hard-deleted. Archive is the correct path. Matches handoff §7 / §44.
- Variants and product-level images **CASCADE** from products.
- Variant-linked images reference `(variant_id, product_id)` **ON DELETE RESTRICT**. Superadmin delete of a product that still has variant images may fail depending on FK order — test in Step 5; prefer deleting/nulling images first or archiving.

`products_admin_manage` is `FOR ALL` for any `private.is_admin()`. **Any current admin can DELETE.** Superadmin-only archive/delete is **not** in RLS today (§5).

### 4.2 Collections — **PARTIAL**

DB `collections`: slug, name, description, `image_path`, `status` (`draft \| published \| archived`), `sort_order`. **READY** as a table.

Storefront discovery is **code-defined** (`src/services/collections.ts`): shop / gender / new-arrivals / best-sellers / locked shapes. `getCollectionBySlug` only returns **shape** definitions. Unknown slugs 404.

DB collection slugs currently affect the storefront only when they are `new-arrivals` or `best-sellers` (merchandising flags via `product_collections`). An Admin-created “Summer edit” row will **not** appear at `/collections/summer-edit` until a later storefront read is added.

Do not create empty public collections. Do not replace route PLPs with invented CMS collections in Admin V1 without a contract change. **BLOCKING for Step 6**, not Step 2.

### 4.3 Orders / fulfilment / tracking — **READY for display + manual fulfilment; writes of orders are not in the storefront yet**

| Handoff need | Schema / contract | Verdict |
| --- | --- | --- |
| List/detail | `orders` + `order_items` (snapshot name/sku/colour/qty/prices) | **READY.** Guest + account customers. `user_id` nullable. |
| Order reference | `order_reference` unique | **READY.** Contract: `createOrderReference` / `isOrderReference`. |
| Status | `placed`, `processing`, `dispatched`, `in_transit`, `out_for_delivery`, `delivered`, `exception`, `tracking_unavailable` | **READY.** Matches customer labels. `isLegalOrderStatusTransition` must be reused. **No cancelled order status.** |
| Payment status display | `orders.payment_status` + `payments` (read-only for authenticated) | **READY to display.** Authenticated GRANT on `orders` is only `(status, updated_at)` — staff **cannot** change payment fields through the user client. Correct while Razorpay is deferred. |
| Customer on the order | `customer_email`, first/last name, `delivery_address` jsonb | **READY.** **No `customer_phone` on orders.** Phone only on `profiles.phone` when `user_id` is set. |
| Discount line | — | **Not supported.** `total_minor = subtotal_minor + shipping_minor`. Do not invent `discount_minor`. Handoff: “Discount if supported.” |
| Manual fulfilment | `shipments`: `carrier_name`, `tracking_number`, `tracking_url`, status, `shipped_at`, `delivered_at`, internal `notes` | **READY.** One shipment per order (`order_id` unique). Carrier is data, not Royal Mail-hardcoded. `notes` is not selectable by client roles. |
| Tracking timeline | `tracking_events` | **READY.** Admin insert requires `created_by = auth.uid()`. |
| Audit of status | `order_events` | **READY** for order/fulfilment events. Admin insert requires `actor_user_id = auth.uid()`. |
| Customer-facing consume | Guest tracking + account (account orders page is still an empty placeholder) | Guest tracking **can** consume shipment fields once orders exist. |

**Storefront does not insert orders.** Checkout is a shell; payment is deferred. Admin Orders will be empty until a later payments slice writes `orders`. That is **DEFERRED**, not an Admin schema hole.

### 4.4 Customers — **READY for operational read**

`profiles` (id = `auth.users.id`, email, names, phone) + `addresses` + orders by `user_id` / `customer_email`. Admin SELECT/UPDATE policies exist for profiles and addresses. Guest checkout customers may have orders **without** a profile (`user_id` null) — list those from `orders`, not only `profiles`.

Do not expose passwords, tokens, session IDs, or Auth internals. `auth.users` is not a customer UI table.

Account `/account/orders` is still a placeholder. Admin order history should query `orders` directly.

### 4.5 Analytics metrics — **DERIVABLE; definitions not locked**

There is **no** analytics warehouse and **no** Admin metrics table. V1 must query commerce tables.

Proposed derivation (not implemented; Syed must lock before Step 3):

| Metric | Proposed source | Exclude |
| --- | --- | --- |
| Revenue | `sum(orders.total_minor)` where `payment_status = 'captured'` | Abandoned carts; `created` / `authorized` / `failed` / `cancelled` payments; do not count carts. |
| Orders | Count of those rows | Same filter. |
| AOV | Revenue / order count (empty → 0, do not fake) | — |
| Products sold | `sum(order_items.quantity)` joined to counted orders | — |
| Trend | `orders.created_at` bucketed | — |
| Recent orders | `orders` newest first | — |

Open: refunded / partially refunded (net vs exclude). Exception orders with captured payment. See §8 Q4.

Operational alerts (only if data exists; never invent urgency):

| Alert | Possible source |
| --- | --- |
| OUT OF STOCK | `product_variants.status = 'available' AND stock_quantity = 0` on a published product |
| LOW STOCK | same with `stock_quantity > 0` and `<= threshold` (**threshold not in schema**) |
| ORDERS NEED FULFILMENT | `orders.status in ('placed','processing')` with captured payment, no non-pending shipment |
| TRACKING MISSING | shipment / order dispatched-or-later with null `tracking_number` |
| FAILED / ATTENTION | `payment_status = 'failed'` or `orders.status = 'exception'` |

With **0 orders**, Step 3 must render empty KPIs and no alerts — not placeholders.

### 4.6 `admin_users` / roles — **CONFLICT with locked Admin V1 roles**

```text
public.admin_role = 'admin' | 'operations' | 'support'
private.is_admin()  →  role = 'admin' AND is_active
```

Handoff locked roles: **Superadmin** and **Admin** (exactly two). Older schema doc (`SHADESUK_Database_Schema_RLS.md` §6) said V1 role is a single `admin` with future `operations` / `support`. **Handoff wins.**

Live: `admin_users` is empty; `operations` / `support` have **zero** RLS access because every admin policy calls `private.is_admin()`.

There is **no** `superadmin` enum value. There is **no** `is_superadmin()`. Destructive product policies and Settings are not split.

`admin_users` grants: **SELECT only** for `authenticated`. No INSERT/UPDATE/DELETE policy except what service_role can do. Staff cannot manage other admins through RLS today. First Superadmin must be bootstrapped with service-role / SQL (Syed lock-in, §8 Q2).

Do not store roles in `user_metadata` (user-editable). `app_metadata` JWT claims would also go stale. Source of truth stays `admin_users`.

---

## 5. Auth / RLS gaps for server-side role enforcement

Handoff §29: authorisation at **route + Server Action/API + RLS**. UI hiding is not the boundary.

### 5.1 What already works

- RLS enabled on all 18 public tables. Security advisor: no lints.
- `private.is_admin()` is `SECURITY DEFINER`, `search_path = ''`, not in the public schema.
- Catalogue public read is published-only.
- Order/payment/shipment customer policies are owner-scoped.
- Service-role module is `server-only` and non-`NEXT_PUBLIC_`.
- Account already uses `getUser()` (not a client-only gate).
- Authenticated users cannot update `orders.payment_status` (column grant).
- No `orders` DELETE policy. Payments are admin-read-only.

### 5.2 Gaps that Admin V1 needs

| Gap | Class | Needed by |
| --- | --- | --- |
| No Superadmin vs Admin split in enum, helper, or RLS | **BLOCKING** | Step 2 role-aware Settings nav; Step 5 archive/delete; Step 9 |
| `products_admin_manage FOR ALL` allows **any** `is_admin()` to DELETE/ARCHIVE (archive is a status update) | **BLOCKING** | Step 5 (design the policy in Step 2 helpers so later steps do not ship a hole) |
| `operations` / `support` cannot even `SELECT` their own `admin_users` row | **BLOCKING** if those labels are remapped to handoff Admin | Step 2 |
| `private` schema is not a PostgREST RPC surface; the app cannot `rpc('is_admin')` unless a public wrapper is added | **NON-BLOCKING** | Step 2 can `SELECT` `admin_users` with the user client **after** `is_admin()` is true; or add `public.current_admin_role()` |
| Proxy does not refresh session on `/admin/**` | **BLOCKING** | Step 2 |
| Root layout injects storefront chrome + cart/catalogue fetch on `/admin` | **BLOCKING** | Step 2 |
| `/admin` not in `ROBOTS_DISALLOW` / no `privatePathMetadata` | **BLOCKING** | Step 2 (cheap, in-shell) |
| No first admin user in Auth or `admin_users` | **BLOCKING** operationally | Step 2 cannot be QA’d against live until Syed bootstraps |
| Settings / admin-user management has no write policies | **BLOCKING** | Step 9, not Step 2 |
| Catalogue/settings audit table missing (only `order_events` / `tracking_events`) | **NON-BLOCKING** for Step 2; report before Step 5 rather than fake audit rows | Step 5 / 9 |
| Customer GRANT `UPDATE (status, updated_at)` on `orders` with no customer UPDATE policy | **NON-BLOCKING** hygiene | unused today; do not add a customer update policy |

### 5.3 Required enforcement shape (do not implement in this PR)

```text
Request
  → Proxy refreshes cookies on /admin/**
  → Layout/page: getUser(); load admin_users; deny if missing/inactive
  → Settings / archive / delete: require Superadmin (server), not CSS
  → Server Action: authenticate + authorise + validate + mutate via user-scoped client
  → RLS: staff helpers, Superadmin-only destructive policies
```

Never: `if (role === "admin")` only in a Client Component.

---

## 6. Storage buckets / image upload readiness

| Item | Status |
| --- | --- |
| Spec buckets `product-images`, `collection-images`, `editorial-images` | Documented in `SHADESUK_Database_Schema_RLS.md` §41. **Not created** (live `storage.buckets` is empty). **No** storage RLS policies. |
| `product_images.storage_path` | Column exists. Relative paths are **not** turned into storefront `src`. Absolute `https://` may be used only with dimensions. |
| Width / height | **Not in schema.** Storefront `ProductImage` requires both. Live mapped products currently emit `images: []` until measured metadata exists (`docs/PHASE3_LIVE_CATALOGUE.md`). Admin upload must persist dimensions or derivatives the mapper can consume, or storefront will stay empty-slotted. |
| `next.config.ts` `images.remotePatterns` | Already allows `https://<supabase-host>/storage/v1/object/public/**`. AVIF/WebP formats enabled. |
| Upload pipeline (validate → resize → compress → WebP → Storage) | **Missing.** `sharp` is only a Next transitive optional; not an app pipeline. No Edge Function. |
| Variant image assignment / reorder | Schema supports `variant_id` + `sort_order` + primary unique indexes. |

**BLOCKING for Step 5 images**, not for Step 2. Do not build a media library (handoff out of scope). Do not transform huge originals on every request.

---

## 7. Conflicts with locked Admin V1 decisions

### 7.1 BLOCKING (must not be papered over)

| # | Conflict | Handoff | Reality | When |
| --- | --- | --- | --- | --- |
| B1 | Roles | Superadmin + Admin; Settings / archive / delete Superadmin-only, server-enforced | Enum `admin \| operations \| support`; `is_admin()` is `admin` only; no Superadmin; all admin policies are identical | Before Step 2 role-aware nav; must be in RLS before Step 5/9 |
| B2 | Admin chrome | Dedicated AdminShell | Root `SiteChrome` wraps the entire app | Step 2 |
| B3 | Route protection | `/admin/**` authenticated + role-checked; `/admin/settings` rejected for Admin | No routes, no proxy matcher, no robots rule | Step 2 |
| B4 | First operator | Authorised staff exist | 0 Auth users, 0 `admin_users` | Operational lock-in before Step 2 QA |
| B5 | Product unpublished | DRAFT / PUBLISHED / UNPUBLISHED / ARCHIVED | `draft \| published \| archived` only | Step 5 |
| B6 | Superadmin-only destructive RLS | Admin must not archive/delete even via URL/action | `FOR ALL` including DELETE/status for every `is_admin()` | Step 5 (policy design in Step 2) |
| B7 | Images actually appear on the storefront | Upload → Storage → storefront | No buckets; no width/height; mapper emits empty `images` | Step 5 |
| B8 | Admin collections ↔ storefront discovery | CRUD + visibility + storefront consistent | DB collections are not storefront routes; only `new-arrivals` / `best-sellers` slugs flip flags | Step 6 |

### 7.2 NON-BLOCKING

| # | Conflict | Resolution |
| --- | --- | --- |
| N1 | Handoff says Tailwind | **Existing tokens + CSS Modules win.** Do not add Tailwind. |
| N2 | Handoff lists a full Admin component kit | Build per step. Step 2 only shell + protection. |
| N3 | `src/lib/supabase/admin.ts` name vs Admin UI | Keep the module; call it “service-role client” in Admin code comments. Do not import it for staff CRUD. |
| N4 | Account orders UI is a placeholder | Admin reads `orders` directly. |
| N5 | No `customer_phone` on orders | Show phone when a linked profile has one. |
| N6 | No discount column | Omit discount line. |
| N7 | `details` jsonb unspecified | Do not invent a CMS shape. |
| N8 | Image type `secondary` vs storefront role `side` | Already mapped in contracts; do not add a third image model. |
| N9 | Performance advisor: unused indexes + multiple permissive policies | Expected on an empty DB with customer+admin policies. Do not drop indexes. |
| N10 | Older Phase 3 docs said “no admin” | Historical lock. This phase lifts it. |
| N11 | Schema doc V1 role = single `admin` | Superseded by this handoff. |

### 7.3 DEFERRED (do not implement in Admin V1)

| Item | Why |
| --- | --- |
| Razorpay / capture / webhooks / refunds / payment secrets in UI | Handoff §5. Display `payment_status` only. |
| Carrier / supplier / Royal Mail APIs / labels | Manual V1. Paste carrier + AWB + https tracking URL. |
| CMS / homepage builder / media library / campaigns | Out of scope. |
| Discount / coupon / loyalty / gift cards / subscriptions | Out of scope. |
| Storefront rebuild / token replacement | Forbidden. |
| Weakening RLS or exposing service-role | Forbidden. |

Payment stays deferred even if dashboard KPIs are empty as a result.

---

## 8. Open questions — Syed lock-in

### Before Step 2 (shell + protection)

**Q1 — Role mapping (BLOCKING).** Pick one; do not leave both in play.

- **Option A (recommended):** add enum value `superadmin`. Map handoff Superadmin → `superadmin`, handoff Admin → existing `admin`. Update `private.is_admin()` to `role in ('admin','superadmin')` and add `private.is_superadmin()`. Leave `operations` / `support` unused until a later phase. Table is empty, so no row rewrite.
- **Option B:** map existing `admin` → Superadmin (matches today’s `is_admin()`), map `operations` → handoff Admin, ignore `support`. Broaden staff RLS to `admin | operations`. Confusing names (`admin` in DB = Superadmin in UI).
- **Reject:** putting the role in `user_metadata`.

**Q2 — First Superadmin bootstrap (BLOCKING for QA).** There are 0 Auth users. Confirm: create Syed’s Auth user in the Supabase dashboard, then insert `admin_users` via SQL/service-role (no self-serve promotion). Record the email used for QA.

**Q3 — Admin entrypoint.** Recommended: unauthenticated `/admin` shows a restrained sign-in (same `signInWithPassword`, `next=/admin`). Authenticated non-admin: deny (not the customer account home). Do not require staff to pass through `/account`. Confirm.

### Before Step 3 (dashboard)

**Q4 — Revenue definition.** Confirm: count only `payment_status = 'captured'`? Exclude `refunded` / `partially_refunded` entirely, or net? Include `exception` orders if payment was captured?

**Q5 — Low-stock threshold.** No column exists. Constant (propose **5** units) until Settings exists, or block the LOW STOCK alert until then?

### Before Step 5 (products)

**Q6 — Unpublish.** Add `unpublished` to `catalogue_status`, or treat unpublish as `draft`? Storefront already hides everything not `published`. Archive remains `archived`.

**Q7 — Image dimensions / derivatives.** Required WebP widths for storefront, and whether `product_images` gains `width`/`height`/`derivative` columns vs encoding them in `storage_path`. Do not invent in Step 2.

### Before Step 6 (collections)

**Q8 — Public collections.** May Admin create new storefront collection pages from DB rows, or only manage membership for locked routes (`new-arrivals`, `best-sellers`, shapes as product `shape` tokens)? Creating empty public collections is forbidden.

### Before Step 9 (settings)

**Q9 — Settings contents for V1.** There is no `store_settings` table and no authenticated write path on `admin_users`. Is V1 Settings “invite/disable staff + role” only (requires new grants/policies), or a larger store-config surface?

---

## 9. Recommended Step 2 plan (AdminShell + route protection, zero feature creep)

Do **not** start Step 2 until Q1–Q3 are locked. If Step 2 is approved with Option A or B, implement **only** the following.

### In scope

1. **Layout split (necessary, not a storefront rebuild).** Move `SiteChrome` out of the root layout into a storefront route group. Root layout keeps `html` / `body` / Inter / skip link / tokens. `/admin` must not fetch the bag or merchandising catalogue.
2. **`src/app/admin/layout.tsx`** — `dynamic = "force-dynamic"`, `privatePathMetadata`, server `requireAdminUser()`.
3. **Session proxy** — add `/admin/:path*` to `src/proxy.ts` matcher (refresh only; still `getUser()` in the layout).
4. **Robots** — add `/admin` to `ROBOTS_DISALLOW`.
5. **Auth helpers** (server-only): `getOptionalAdminUser()`, `requireAdminUser()`, `requireSuperadminUser()`. Cookie-bound client. Query `admin_users` (and/or a public wrapper around the private helpers after Q1). **No** service-role for the gate. **No** role in `user_metadata`.
6. **Role migration** — only the Q1 mapping (enum/helper/RLS staff vs Superadmin). No product UI. Superadmin-only **DELETE** (and archive-as-status if encoded now) should be expressed in RLS in this slice so Step 5 cannot ship a hole; if that is judged too early, document it as an explicit leftover and do not ship product delete until it exists.
7. **AdminShell** — sidebar (HOME, ORDERS, PRODUCTS, COLLECTIONS, CUSTOMERS, ANALYTICS, divider, SETTINGS if Superadmin), topbar (search control can be a non-functional labelled input or omitted until a later step — do **not** wire catalogue search), notifications placeholder **without fake counts**, profile (email + role). Mobile: drawer, no hover-only actions, 44px targets, tokens only, no glass/gradients/fake charts.
8. **Routes that must exist so protection can be tested:**
   - `/admin` — protected empty home. Copy: operations home ships in Step 3. **No fake KPIs.**
   - `/admin/settings` — Superadmin: empty settings stub (“Step 9”). Admin: **server deny** (not a hidden link that still renders).
9. **Unauthenticated `/admin`** — restrained sign-in (Q3). Authenticated customer with no `admin_users` row: deny.
10. **Styling** — new CSS Modules under `src/components/admin/`. Reuse Button/Drawer/EmptyState/Field. Do not add Tailwind. Do not restyle the storefront.

### Explicitly out of Step 2

Dashboard metrics, order list/detail, product CRUD, uploads, collections CRUD, customers, analytics charts, Settings forms, Razorpay, carrier APIs, discounts, CMS, seed catalogue, service-role staff CRUD, fake notifications.

Other nav hrefs may 404 until their step **or** be empty protected shells with “ships in Step n” and **no data fetching**. Prefer 404 for unused hrefs if that keeps the PR smaller; do not build tables “while we are here”.

### Step 2 test matrix (from handoff §46–47, bounded)

| Case | Expected |
| --- | --- |
| Signed out → `/admin` | Sign-in, not storefront chrome bag |
| Signed out → `/admin/settings` | Sign-in or deny, never Settings body |
| Customer session → `/admin` | Deny |
| Admin (handoff) → `/admin` | Shell |
| Admin → `/admin/settings` (URL) | Server deny |
| Superadmin → `/admin/settings` | Stub |
| Refresh on `/admin` | Session still valid (proxy matcher) |
| Storefront `/`, PLP, PDP, cart, checkout, account | Unchanged chrome and behaviour |

No product archive/delete tests until Step 5, unless the RLS split is included in the Step 2 migration (then test via SQL/policy, not UI).

### After Step 2

Step 3 Dashboard (real queries, empty-honest). Then Orders → Products → Collections → Customers → Analytics → Settings → QA, one step at a time.

---

## 10. What this audit did not do

- Did not implement Admin UI, routes, or migrations.
- Did not create storage buckets or Auth users.
- Did not merge or rebase [#22](https://github.com/Shadesuk/Shadesuk-live/pull/22).
- Did not treat empty live tables as a reason to wire demo fixtures into Admin.
- Did not inspect the Vercel env dashboard.
- Did not run storefront visual QA (no UI change).

---

## IMPLEMENTED

Docs only: repository/schema/auth/UI audit for Admin V1 Step 1.

## FILES CHANGED

- `docs/ADMIN_V1_AUDIT.md` (this file)
- `docs/ADMIN_V1_SECURITY.md`

## DATABASE

None.

## AUTH/RLS

None changed. Gaps documented.

## UI

None.

## TESTS

Not applicable (documentation). Live schema/enums/policies/buckets/row counts verified via Supabase SQL against Shadeslive. Git `main` at `ee74f80`.

## EDGE CASES

Documented: unpublished vs draft; products with order history cannot DELETE; guest orders without profiles; payment column grants; empty metrics; collection route vs DB collection.

## REGRESSION

No storefront code changed.

## KNOWN ISSUES

See §7–§8. Step 2 must not start until Q1–Q3 are locked.

## NEXT STEP

**Step 2 — AdminShell + route protection**, after Syed lock-in on Q1–Q3. No feature creep.

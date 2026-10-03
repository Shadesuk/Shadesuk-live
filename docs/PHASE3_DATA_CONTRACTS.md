# SHADESUK Phase 3.3 — Data contracts

**Phase:** 3.3 — Database / data contracts  
**Status:** Complete for this slice (contracts + mappers; no PDP/cart/checkout UI)  
**Canonical schema:** [PR #10](https://github.com/Shadesuk/Shadesuk-live/pull/10) `cursor/initial-production-schema-e3d9`  
**Stacked on:** [PR #12](https://github.com/Shadesuk/Shadesuk-live/pull/12) (Phase 3.2 env audit)  
**Date:** 2026-09-15  
**Code:** `src/contracts/` (import from `@/contracts`)

This slice maps the approved storefront types onto PR #10. It does **not** query Supabase, add Route Handlers, mount payment SDKs, build admin UI, or call carrier APIs.

Demo discovery (`src/data/catalogue.ts`, ProductCard, PLP, search) is unchanged and still fixture-backed.

---

## 0. Out of scope (locked)

| Surface | Status |
| --- | --- |
| Payment provider integration (Stripe / Razorpay / webhooks / checkout charge) | **Out of scope** |
| Paid-state webhook implementation | **Out of scope** |
| Admin dashboard | **Out of scope** |
| Shipping / carrier / supplier APIs | **Out of scope** |
| PDP / cart / checkout UI | **Out of scope** (later 3.4–3.9) |
| Opening anon RLS writes on `carts` / `cart_items` | **Forbidden** |
| Inventing provider env names as final (`STRIPE_*`, `RAZORPAY_*`) | **Forbidden** |
| Loading the live catalogue into the client bundle | **Forbidden** at cutover (3.4) |
| Unauthenticated Route Handler returning service-role rows | **Forbidden** |

3.2 D1–D5 / D8 remain **HUMAN LOCK-IN**. This run treats **D6 = PR #10 is canonical** and **D7 = manual V1 fulfilment**, per Syed’s Phase 3.3 scope lock. Payment columns are documented as **opaque stubs**.

---

## 1. Sources

| Source | Role |
| --- | --- |
| PR #10 SQL | Live tables, enums, RLS, grants (already applied on Supabase **Shadeslive**; may be unmerged in git) |
| `src/types/catalogue.ts` | Approved storefront Product / Brand / Colour / Variant view-model |
| Handoff §§7–12, 23–33, 63–64 | Product, price, cart, order, guest tracking, security |
| `account_order_tracking.md` §11 | Guest form: order reference + email |
| `docs/PHASE3_REPO_AUDIT.md` §6.3–6.4 | Conflicts this slice must not silently “fix” |

---

## 2. Catalogue mapping

### 2.1 Entity map

```text
PR #10                         Storefront (types/catalogue.ts)
---------                      --------------------------------
products                       Product (one row, published only)
products.brand (text)          Brand.id/slug/name (DERIVED; no brands table)
products.gender (text)         Product.gender[] (parsed tokens; unknown omitted)
products.shape (text)          Product.shape[] (parsed tokens; unknown omitted)
(no style column)              Product.style[] = [] always
product_variants               Product.variants[] + Product.colours[]
product_variants.colour_name   ProductColour (id/slug from slugified name; no hex)
product_variants.price_minor   Product.price (MAJOR units, min selectable variant)
product_variants.stock_qty     Availability only (quantity stays server-side)
product_variants.sku           ProductVariant.sku
product_images                 CatalogueImageDto; Product.images only with dimensions
collections + product_collections
  slug new-arrivals            Product.isNewArrival
  slug best-sellers            Product.isBestSeller
products.disclosure            NOT mapped to UI (global PDP component)
```

### 2.2 Field-level Product

| Storefront | Database | Mapper rule |
| --- | --- | --- |
| `id` | `products.id` | UUID string |
| `slug` | `products.slug` | As stored (already kebab-case) |
| `name` | `products.name` | As stored |
| `brandId` | `products.brand` | Slug of trimmed brand text; `""` if brand is null/blank (do not invent a name) |
| `gender[]` | `products.gender` | Split on `,` `/` `\|`; keep only `men` \| `women` \| `unisex` |
| `shape[]` | `products.shape` | Same split; keep locked shapes (`cat-eye` aliases allowed) |
| `style[]` | — | Always `[]` |
| `colours[]` | distinct `colour_name` | See §2.4 |
| `price` | min `price_minor` | Convert pence → pounds. Card uses selectable variants first |
| `currency` | `currency` | `GBP` only (DB check) |
| `availability` | variants | See §2.5 |
| `isNewArrival` | collection slug `new-arrivals` | Else `false` (no column to invent from) |
| `isBestSeller` | collection slug `best-sellers` | Else `false` |
| `images[]` | `product_images` | Empty until width/height exist (§2.6) |
| `isDemo` | — | `false` for mapped live rows |
| `compareAtPrice` | `compare_at_price_minor` on the priced variant | Omit if null |
| `variants[]` | non-draft/archived variants | `id`, `colourId`, `availability`, `sku` |
| `sizes[]` | distinct `size_name` | Omit if all null |
| `measurements` | variant mm columns | Only if all provided variants agree; else omit |
| `description` | `products.description` | Omit if blank |
| `details` | `products.details` jsonb | **Not** stringified. Shape unknown; omit storefront `details` string |

PDP extras (`materials`, `whats_included`, `fit`) live on `MappedStorefrontProduct.pdp` for projection `"pdp"` only. Card projection does not attach them.

### 2.3 Brand

There is **no `brands` table**. `deriveBrandSource()` / `deriveBrandsFromProducts()` build `BrandSource` from distinct published `products.brand` values.

- `id` = `slug` = slugified name (not a UUID)
- `status` = `active` if any published product uses that name
- `isDemo` = `false`
- `description` / `logo` omitted (no columns)

`productCount` remains a read-time derivation in the catalogue service (unchanged). 3.4 should count published products per derived slug, not invent a stored count.

### 2.4 Colour / variant

Colours are attributes of variants, not rows.

- `ProductColour.id` / `slug` = slugified `colour_name` (stable for filters)
- `name` = trimmed `colour_name`
- **`hex` omitted** — no swatch column; never invent `#111111`
- `available` = variant `status = available` **and** `stock_quantity > 0`

**Projections** (same `Product` type, different colour arrays):

| Projection | Colours included | Why |
| --- | --- | --- |
| `"card"` | Selectable only | PLP “N colours” must match purchasable variants (handoff §8) |
| `"pdp"` | All non-draft/archived, with `available` flags | Swatches can show unavailable colours |

Demo catalogue is **not** remapped. Frame 01 still reports 4 colours including fixtures that are not variant-backed. Switching ProductCard to the live selectable count is a 3.4 cutover task, not a silent demo change.

SKU is required and unique on `product_variants`. Storefront `ProductVariant.sku` is optional for demo compatibility; live mapper always sets it.

### 2.5 Availability and inventory

| Condition | `Product.availability` |
| --- | --- |
| Any variant available + stock > 0 | `in_stock` |
| Some `status = available` but all those have stock 0 | `out_of_stock` |
| No available-status variants in the aggregate | `sold_out` |

`stock_quantity` is **server-authoritative** and must not be sent to ProductCard as “only N left”. Handoff forbids fabricated scarcity.

**RLS conflict (reported, not changed):** anon SELECT on `product_variants` is `status = available` only. Public PostgREST will not return unavailable colours. Disabled PDP swatches for archived/unavailable colours need a later schema/RPC decision, not a mapper lie.

### 2.6 Price authority

- DB: integer minor units on the **variant**
- Storefront `Product.price`: major units so existing `formatGbp()` keeps working
- Card price = minimum `price_minor` among selectable variants (else available, else any supplied)
- Client-submitted prices are never trusted (handoff §10). Cart stores `unit_price_minor` as a snapshot and must revalidate before payment (3.6 / 3.10)

Helpers: `minorToMajorGbp` / `majorToMinorGbp` in `src/contracts/money.ts`.

### 2.7 Images

| Schema `product_image_type` | Storefront `ProductImageRole` |
| --- | --- |
| `primary` | `front` |
| `secondary` | `side` (no equal role; this is the extra/hover shot — **conflict**) |
| `detail` | `detail` |
| `side` | `side` |
| `lifestyle` | `on-model` |

Frontend roles `back`, `temple`, `packaging` have **no** schema value. Do not invent them.

PR #10 has **no width/height**. `ProductImage` requires both. Mapper leaves `Product.images = []` until 3.4 supplies measured dimensions. Relative `storage_path` is **not** turned into `src`. Absolute `https://` paths may be used as `src` only when dimensions are also provided.

`next.config.ts` still has no Storage `remotePatterns` (3.2). Live `next/image` is a 3.4 config task.

### 2.8 Merchandising vs collections

Locked storefront routes `/new-arrivals` and `/best-sellers` stay code-defined `CollectionDefinition`s. DB `collections` rows with those slugs, linked through `product_collections`, set the booleans.

Gender/shape PLPs (`/men`, `/collections/aviator`, …) stay **route collections**, not necessarily DB rows. Do not replace `src/services/collections.ts` in this slice.

If merchandising collection slugs differ in CMS data, flags stay `false`. Do not infer “new” from `created_at`.

### 2.9 Disclosure / details / style

- **Disclosure:** PDP must render the approved component. `products.disclosure` is a NOT NULL default in SQL; **ignore it in UI mapping** until legal review says otherwise.
- **`details` jsonb:** object shape is unspecified. Do not invent a string.
- **Style:** unpublished. Mapper always emits `[]`.

---

## 3. Guest cart session

### 3.1 Why server mediation

PR #10:

- `carts` is owned by **either** `user_id` **or** `session_id` (XOR)
- One active cart per user / per session (partial unique indexes)
- Grants: **no** anon access to `carts` / `cart_items`
- RLS: authenticated `user_id = auth.uid()` only

Guest add-to-bag **cannot** be `supabase-js` from the browser against those policies. Opening anon INSERT/UPDATE is **rejected**.

### 3.2 Cookie contract

| Attribute | Value |
| --- | --- |
| Name | `shadesuk_guest_cart` |
| Value | `session_id` (64 lowercase hex chars, 32 random bytes) — **not** `carts.id` |
| httpOnly | `true` |
| Path | `/` |
| SameSite | `Lax` |
| Secure | `true` in production; may be false on localhost http |
| Max-Age | 30 days |

Client JavaScript must not read this cookie. Client bodies must not submit `session_id` or `cart_id` as proof of ownership. The server reads the cookie.

Code: `createGuestCartSessionId`, `guestCartCookieSetOptions`, `CART_MEDIATION_RULES`.

### 3.3 Mediation (3.6 implements)

```text
Browser (no cart writes)
  → Route Handler / Server Action (cookie)
      → service-role or SECURITY DEFINER RPC
          WHERE session_id = cookie AND user_id IS NULL AND status = 'active'
```

Hard rule: that handler must authenticate the **session cookie**, not “anyone with a UUID”. It must not become a public GET that dumps admin-client rows (3.1 / 3.2 security appendix).

Authenticated carts use `user_id` + existing RLS. Guest → account merge uses `CART_MERGE_POLICY`:

| Conflict | Policy |
| --- | --- |
| Same variant in both | Sum quantities, then cap to stock |
| Variant sold out | Drop **with customer-visible notice** |
| Price changed | Keep line; revalidate `unit_price_minor` before payment |
| Product removed | Drop with notice |
| Guest cart after merge | `status = converted` |

Never lose a guest line silently.

`unit_price_minor` on `cart_items` is a snapshot. Display totals are derived; payable totals are recomputed server-side from live variants + shipping.

---

## 4. `order_reference` + guest tracking

### 4.1 Reference format

SQL: `orders.order_reference` unique `text`, no format check.

**Generator (importable now):**

```text
New public references are 4 digits (`4827`). Legacy `SHU-` + 12 Crockford references remain valid for existing orders.
Regex: ^[0-9]{4}$ or ^SHU-[0-9A-HJKMNP-TV-Z]{12}$
A 4-digit code is guessable. Guest tracking still requires the checkout email.
```

Not sequential, not the order UUID, not SKU, not a payment id.

**Conflict:** locked UI mock `ORDER #SHU10294` is guessable. Display stays `ORDER #{order_reference}` (`formatOrderHeading`). The mock string **must not** be accepted by `parseOrderReferenceInput`.

Routes can wait for 3.10 / 3.13. Creation must call `createOrderReference()` and retry on unique violation.

### 4.2 Guest tracking verification shape

Locked form (`account_order_tracking.md`):

```text
Order reference
Email
[ TRACK ORDER ]
```

Request DTO:

```ts
{ orderReference: string; email: string }
```

Server (3.13):

1. Rate-limit (documented: 5 attempts / 15 minutes / ip+reference — not implemented here).
2. Parse with `parseGuestTrackingRequest` (invalid → generic error, no oracle).
3. Service-role lookup by `order_reference` (anon has **no** SELECT on `orders`).
4. Compare emails with `emailsMatch` (normalised + SHA-256 + `timingSafeEqual`).
5. On success, return `GuestOrderTrackingView` only.

Generic copy:

> We couldn't find an order with those details.

Same message for malformed input, unknown reference, and wrong email.

**Forbidden:** `/order/12345` or `/order/{reference}` revealing an order without this verification (or an equivalent post-verify session). Account holders use `auth.uid() = orders.user_id` RLS, not this form.

`GuestOrderTrackingView` includes status, items (name/colour/size/qty), total, optional customer shipment fields. It **excludes** payment provider ids, webhook payloads, shipment `notes`, admin events, and other customers’ data.

---

## 5. Payment stubs (provider-agnostic)

PR #10 `payments` columns used as an envelope, not a vendor lock:

| Column | Contract meaning |
| --- | --- |
| `provider` | Opaque string. Use `unset` until D1 is locked. |
| `provider_order_id` | Opaque handle from whichever provider is chosen later |
| `provider_payment_id` | Opaque handle |
| `status` | Schema enum (below) |
| `failure_reason` | Internal; do not show raw codes to customers |
| `amount_minor` / `currency` | Must match server-calculated order total / `GBP` |

`payment_webhook_events` **exists in the schema** for a later idempotent processor. Phase 3.3 does **not** implement webhooks, signature verification, or paid-state transitions from HTTP callbacks.

Trust rule (handoff §19 / §108): the storefront must not mark an order paid because the customer returned from a payment page. Paid = verified provider confirmation **when 3.9 exists**. Until then, `created` is not success.

### 5.1 Status map (schema → handoff §20)

| PR #10 `payment_status` | Customer state | Notes |
| --- | --- | --- |
| `created` | `PAYMENT_READY` | Not paid |
| `authorized` | `PAYMENT_PROCESSING` | Razorpay-shaped name; not treated as Stripe |
| `captured` | `PAYMENT_SUCCEEDED` | Only this is “paid” at the schema layer |
| `failed` | `PAYMENT_FAILED` | |
| `cancelled` | `PAYMENT_CANCELLED` | |
| `refunded` / `partially_refunded` | `PAYMENT_UNKNOWN` | No handoff equivalent; operational |
| — | `PAYMENT_REQUIRES_ACTION` | **No schema value.** Do not fake it |

Do not add Stripe/Razorpay SDK types. `src/types/integrations.ts` still has a historical `"stripe"` placeholder; it is **not** a lock (see 3.2 D1).

Env names for a future provider stay **illustrative** in the 3.2 audit. This slice does not add them to `.env.example`.

---

## 6. Manual fulfilment / shipments

V1 = **manual** (schema spec + this run’s D7 lock). No supplier tables, no carrier APIs, no Royal Mail API, no label purchase.

`shipments` is **1:1** with `orders` (`order_id` unique). Partial multi-package fulfilment is **not** in the schema (handoff §29 lists it — **conflict**, deferred).

Operators (admin / 3.11 later, not this PR) may set:

- `carrier_name`
- `tracking_number` (AWB)
- `tracking_url` (pasted; not generated)
- `status` (`shipment_status` enum)
- `shipped_at` / `delivered_at`
- `notes` (internal; **revoked from client SELECT**)

`tracking_events` is an append-only timeline (`status`, `description`, `occurred_at`). Customer view: `toCustomerShipmentView` — no `notes`, no `created_by`.

When tracking is missing, customer copy (locked):

**TRACKING NOT AVAILABLE YET**  
Your order has been received. Tracking information will appear once your shipment has been dispatched.

That is a normal state (`pending` / `tracking_unavailable`), not a system failure. Do not invent carrier events.

China-origin / last-mile abstraction in handoff §27–30 is **architecture for later**. V1 stores whatever carrier string an operator types.

Order status vs shipment status stay separate enums that happen to share several labels. Customer UI uses **order** status (`customerOrderStatusLabel`). Shipment fields feed the tracking timeline when present.

Legal order transitions: `isLegalOrderStatusTransition` (`placed → processing → dispatched → in_transit → out_for_delivery → delivered`, with `exception` / `tracking_unavailable` branches). Frontend cannot PATCH status.

---

## 7. Security constraints encoded here

1. No unauthenticated handler may return `createSupabaseAdminClient()` data.
2. Guest cart writes: cookie + server mediation; **no** anon RLS writes.
3. Guest tracking: non-guessable reference **and** email verification.
4. Live catalogue must be served as **page-sized** RSC/Route Handler props in 3.4 — `ProductCard` must not import a module that loads every product. 3.3 does not change ProductCard (demo fixtures remain).
5. Payment stubs carry no secrets and no webhook processor.

---

## 8. TypeScript modules

Import barrel: `@/contracts`.

| Module | Responsibility |
| --- | --- |
| `src/contracts/money.ts` | Minor/major GBP |
| `src/contracts/catalogue/schema.ts` | PR #10 row types |
| `src/contracts/catalogue/taxonomy.ts` | Gender/shape parse, slugify |
| `src/contracts/catalogue/brand.ts` | Derived brands |
| `src/contracts/catalogue/colour.ts` | Colours from variants |
| `src/contracts/catalogue/availability.ts` | Stock → availability |
| `src/contracts/catalogue/image.ts` | Image type map |
| `src/contracts/catalogue/merchandising.ts` | Collection slug flags |
| `src/contracts/catalogue/map-product.ts` | Aggregate → `Product` |
| `src/contracts/cart/session.ts` | Cookie + session id |
| `src/contracts/cart/schema.ts` / `dto.ts` | Cart rows, view, merge policy |
| `src/contracts/order/reference.ts` | `order_reference` |
| `src/contracts/order/tracking.ts` | Guest verification |
| `src/contracts/order/schema.ts` / `dto.ts` / `status.ts` | Orders |
| `src/contracts/payment/stub.ts` | Opaque payment envelope |
| `src/contracts/fulfilment/shipment.ts` | Manual shipment view |

Verify: `npm run verify:contracts`.

---

## 9. Conflicts (do not silently invent)

Carried forward from 3.1 §6 and closed or restated for 3.3:

1. **No brands table** — derived from `products.brand` text. A real brands entity is a schema extension, not a mapper fiction.
2. **Scalar gender/shape vs arrays** — parse known tokens; drop unknown; do not guess `unisex` for blank.
3. **Variant price vs product price** — card uses min selectable minor units converted to major.
4. **Colour hex / colour table missing** — omit hex.
5. **Merchandising columns missing** — collection slugs `new-arrivals` / `best-sellers` only.
6. **Image roles mismatch** — mapping table in §2.7; `secondary` ≈ extra shot.
7. **Image dimensions missing** — do not invent; `Product.images` stays empty.
8. **`details` jsonb unspecified** — omit string `details`.
9. **Disclosure column vs global component** — UI uses the component.
10. **Guest cart RLS** — server-mediated cookie; anon writes stay closed.
11. **UI order number `SHU10294`** — rejected; use `SHU-` + Crockford.
12. **Stripe vs Razorpay** — still unlocked; payment fields opaque; no env names as final; no webhooks.
13. **Handoff supplier chain vs manual V1** — V1 manual; supplier tables not invented.
14. **`PAYMENT_REQUIRES_ACTION`** — no schema value; unused.
15. **Partial fulfilment** — schema is one shipment per order.
16. **Public RLS hides unavailable variants** — PDP disabled swatches blocked until a later read model.
17. **Demo colour count vs selectable-count rule** — demo unchanged; live card projection uses selectable colours.
18. **`integrations.ts` `"stripe"`** — historical placeholder, not D1.

---

## 10. What 3.4+ should import (and not rebuild)

- 3.4 Catalogue: `mapProductAggregateToStorefront`, derived brands, merchandising slugs. Serve page slices from the server; do not replace ProductCard.
- 3.5 Inventory: `productAvailabilityFromVariants`; keep `stock_quantity` off the client card.
- 3.6 Cart: cookie helpers + `toCartView` + merge policy. No anon RLS change.
- 3.9 Payment: fill opaque stub after D1; implement webhooks only then.
- 3.10 Orders: `createOrderReference`; snapshots already typed on `order_items`.
- 3.11 Fulfilment: `toCustomerShipmentView`; manual fields only.
- 3.13 Tracking: `parseGuestTrackingRequest` + `GuestOrderTrackingView`.

---

## 11. Checklist

- [x] Map Product / Brand / Colour / Variant / price / merchandising ↔ PR #10
- [x] Guest cart httpOnly cookie + server mediation; anon RLS writes stay closed
- [x] Non-guessable `order_reference` + guest-tracking verification shape
- [x] Payment fields documented as opaque stubs; no paid-state webhooks
- [x] Manual fulfilment / shipments without carrier APIs
- [x] `docs/PHASE3_DATA_CONTRACTS.md`
- [x] TypeScript DTO/mapper modules at `src/contracts/`
- [x] Demo storefront types/UI not replaced; discovery fixtures intact

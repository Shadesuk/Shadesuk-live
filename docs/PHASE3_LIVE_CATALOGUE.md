# SHADESUK Phase 3 — Live catalogue + search harden

**Phase:** Slice A of storefront completion  
**Stacked on:** [PR #19](https://github.com/Shadesuk/Shadesuk-live/pull/19)  
**Out of scope:** Razorpay/payment, admin dashboard, shipping/carrier APIs, merge to main, full SEO/a11y/Impeccable/regression report

`SHADESUK_Production_Integration_Master_Spec.md` is **not in this repository**. This slice follows the Phase 3 handoff plus `search.md`, `plp.md`, `seo_performance.md`, `responsive_accessibility.md`, and `global_components_ui_states.md`.

Supabase **published** catalogue rows are authoritative for production catalogue behaviour.

---

## Production vs demo paths

```text
DEMO_CATALOGUE=true|1
  → fixture catalogue (Frame 01–06), even if Supabase is configured.
    Explicit demo/development isolation only.

Else fetch published products via the publishable/anon key + RLS
  (never the service-role client).

  Live fetch OK (including 0 published rows)
    → live snapshot. Empty DB → designed empty states. No demo mix-in.

  Live unconfigured or live error
    → if NODE_ENV=development (and DEMO_CATALOGUE is not false): demo fixtures
    → if production: empty states (unconfigured) or collection error (fetch failure)
```

Production with an empty published catalogue **does not** silently serve Frame 01–06.

Pages mark the source on the collection `<main>`: `data-catalogue-source="live|demo|empty"`.

---

## What is live (server)

- Home product rails, PLP (`/shop`, gender, merchandising), shape collections, brand index/pages
- `/search` results (same CollectionTemplate / ProductCard / FilterBar / Sort)
- Search suggestions via `GET /api/search/suggest` (debounced + aborted in the overlay)
- Header Shop / mobile brand links and search discovery brand chips
- Cart “You may also like” from the storefront snapshot
- Recently viewed: fetches by id through the existing server action (no full catalogue in the client)

Client components receive **props**. `ProductCard` and `SearchForm` no longer import `@/services/catalogue` or scan the full catalogue in the browser.

---

## What still uses fixtures

Allowed only on the demo path above:

| Surface | Fixture use |
| --- | --- |
| `src/data/catalogue.ts` | Frame 01–06 / Demo Line A–C |
| Demo PDP / add-to-bag / demo cart cookie | When a demo product is resolved |
| Verify scripts (`verify:catalogue`, `verify:collections`, `verify:search`, `verify:discovery`) | Fixture integrity for the approved frontend |

Not replaced in this slice (still not live catalogue):

- Editorial homepage media placeholders
- Cart/checkout/account/tracking beyond using the storefront snapshot for suggestions
- Payment, admin, shipping APIs (locked out)

Live mapped products still omit images until width/height exist (contracts). Colour hex is omitted on live rows. Style stays `[]`.

---

## Env names (values not recorded)

Required for the live path:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `NEXT_PUBLIC_SITE_URL`

Optional:

- `DEMO_CATALOGUE` — see `.env.example`
- `SUPABASE_SECRET_KEY` / `GUEST_COOKIE_SECRET` — cart/checkout, not catalogue reads

Catalogue reads use the publishable key. The secret key is not used to list products.

---

## Empty-DB production behaviour (honest)

If Supabase is configured and `products` has **0 published rows**:

- `/shop`, gender, merch, shape, brand PLPs: **No shades available.**
- Home rails that have no products are omitted
- Brand/collection hubs: **No brands/collections available.**
- Search: no hits / no suggestions
- Counts are `0 shades`

That is an empty catalogue, not a demo store.

If the live fetch **errors** (not merely empty), collection routes use the existing “We couldn’t load this collection.” error UI.

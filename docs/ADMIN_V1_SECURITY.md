# SHADESUK Admin V1 — Security appendix

**Phase:** Admin V1 / Step 1  
**Companion to:** [`docs/ADMIN_V1_AUDIT.md`](./ADMIN_V1_AUDIT.md)  
**Date:** 16 September 2026  
**Audited commit:** `ee74f80` on `main`  
**Live project:** Shadeslive — RLS enabled on all 18 public tables; security advisor clean at audit time.

This is a checklist for later Admin steps. It does not authorise schema changes or Admin UI in Step 1.

Vocabulary matches the storefront classification: **BLOCKING** / **NON-BLOCKING** / **DEFERRED**.

---

## 1. Hard rules (do not weaken)

- Do not disable RLS, add broad public write policies, or expose `service_role` / `SUPABASE_SECRET_KEY` to the browser.
- Do not import `src/lib/supabase/admin.ts` from Client Components (already `server-only`).
- Do not use `user_metadata` for role checks (`raw_user_meta_data` is user-editable).
- Do not treat JWT `app_metadata` as fresh without a table lookup; `admin_users` is the source of truth.
- Do not trust `role`, price, stock, product status, order status, or customer ID from the browser.
- Do not show Postgres / Supabase / stack traces to operators.
- Do not display API secrets, service-role keys, payment secrets, or DB credentials — including in Superadmin Settings.
- Payments, webhooks, carrier APIs, CMS builders, and discounts stay **DEFERRED**.

---

## 2. Three layers (handoff §29–§31)

Every Admin mutation:

```text
Authentication (getUser on the server)
  → Authorisation (admin_users role + is_active)
  → Input validation (server)
  → Database operation (cookie-bound client so RLS applies)
```

UI hiding of Settings / Archive / Delete is **not** sufficient. Direct URL and Server Action must fail for handoff Admin.

---

## 3. Findings carried into Admin V1

### BLOCKING for Admin shell / later destructive steps

| Item | Status now | Required |
| --- | --- | --- |
| No `/admin` routes or proxy matcher | Missing | Add `/admin/:path*` to `src/proxy.ts`; still call `getUser()` in the admin layout. |
| Root layout wraps Admin in storefront `SiteChrome` | Present | Split layouts so `/admin` does not load bag/search/merchandising chrome. |
| `/admin` indexable | `ROBOTS_DISALLOW` omits it | Disallow `/admin`; `privatePathMetadata` on admin layouts. |
| Superadmin vs Admin | Enum has `admin \| operations \| support`; `private.is_admin()` is `role = 'admin'` only | Syed lock-in (audit Q1) then migration: staff helper + Superadmin helper; Settings and product archive/delete Superadmin-only **in RLS**. |
| `products_admin_manage FOR ALL` | Any `is_admin()` can DELETE | Superadmin-only DELETE (and archive if that is a status write restricted the same way). Prefer archive when `order_items` RESTRICT blocks delete. |
| Zero Auth users / zero `admin_users` | Empty | Dashboard bootstrap of the first Superadmin (service-role/SQL). No self-serve promotion. |
| Client-only redirects as authorisation | Not used on account today | Keep it that way on Admin. |

### NON-BLOCKING (do not “fix” by weakening)

| Item | Notes |
| --- | --- |
| Health oracle `GET /api/health/supabase` | Unauthenticated; production body already redacted. Not an Admin issue. |
| Guest tracking / live cart use service-role | Existing trusted-server paths after verification. **Do not copy** for staff product/order CRUD. |
| Multiple permissive RLS policies (customer + admin) | Performance advisor WARN; expected. Keep both. |
| Unused indexes | Empty tables. Keep. |
| `orders` GRANT `UPDATE (status, updated_at)` to `authenticated` | No customer UPDATE policy, so unused. Do not add one. Conveniently **prevents** staff changing `payment_status` through the user client. |
| `admin_users` SELECT-only for authenticated | Correct until Step 9; first row is service-role insert. |
| `private.is_admin()` not exposed on Data API | Intentional. Query `admin_users` with the user JWT, or add a narrow public wrapper later. |

### DEFERRED

| Item | Reason |
| --- | --- |
| Payment secrets, webhook signatures, capture, refunds | Payment lock. Display `payment_status` only. |
| Carrier APIs | Manual fulfilment. Tracking URL https-only (storefront already rejects `http` / `javascript:`). |
| Storage public-read + admin-write buckets | No buckets yet. Create with Step 5; anon must not upload. |
| Catalogue audit log | `order_events` / `tracking_events` exist; no product/collection/settings audit table. Report rather than fake rows. Add before destructive product actions if Syed wants an audit trail. |

---

## 4. Step 2 security checklist (when that step is approved)

Copy forward; tick only when tested.

- [ ] Unauthenticated `/admin` and `/admin/settings` do not render Admin data
- [ ] Customer session cannot access `/admin`
- [ ] Handoff Admin can access `/admin` and cannot access `/admin/settings` via URL
- [ ] Superadmin can access `/admin/settings`
- [ ] Session refresh works on `/admin` after reload
- [ ] Role is read from `admin_users`, not `user_metadata`
- [ ] Staff queries use `createSupabaseServerClient()`, not the service-role client
- [ ] `/admin` is noindex / robots-disallowed
- [ ] Storefront chrome (bag, search, Shop menu) is absent on `/admin`
- [ ] No secrets in Admin UI
- [ ] RLS still enabled; no new public write policies
- [ ] Error copy does not leak SQL

Archive/delete UI tests wait for Step 5, but if Step 2 ships the Superadmin DELETE policy, verify with a non-Superadmin Server Action or SQL attempt.

---

## 5. IDOR / customer data

Once `private.is_admin()` (or the locked staff helper) is true, Admin **intentionally** reads all orders, profiles, and addresses. That is not IDOR for staff; it **is** IDOR if a customer JWT can pass the gate.

- Gate every `/admin` page and action on `admin_users`.
- Do not add a public `/admin` Route Handler that returns service-role rows.
- Guest tracking must stay reference + email + rate limit; never a guessable `/order/12345`.

---

## 6. Uploads (Step 5, recorded now)

- Validate MIME, size, and dimensions server-side.
- Authorised admin/server write only.
- Public read only for intended catalogue imagery.
- Storage upsert needs INSERT + SELECT + UPDATE.
- Do not convert logos/icons to JPEG/WebP.
- Persist derivatives, do not re-transform originals per request.

---

## 7. Service-role inventory (do not expand casually)

Current `createSupabaseAdminClient()` callers:

| Caller | Purpose |
| --- | --- |
| `src/lib/supabase/health.ts` | Connectivity probe |
| `src/services/guest-tracking.ts` | Verified guest order lookup (no customer JWT) |
| `src/services/cart-live.ts` | Guest cart writes (anon has no cart GRANT) |

Admin V1 staff operations should **not** join this list unless a specific table cannot be granted to authenticated staff under RLS. Prefer grants + policies.

---

## 8. Launch note

Admin V1 is not complete until the handoff test matrix (§46–53) passes on **both** UI and direct URL/API/server mutation, and the storefront regression list still holds. This appendix does not declare that bar met.

# SHADESUK Phase 3 — Environment / Configuration Audit

**Phase:** 3.2 — Environment/configuration audit  
**Status:** Complete (audit only; no wiring, no secrets invented, no provider choice treated as final)  
**Audited commit:** `a79678e` on `main` (same storefront as [PR #11](https://github.com/Shadesuk/Shadesuk-live/pull/11) / 3.1)  
**Schema PR (unmerged):** [#10](https://github.com/Shadesuk/Shadesuk-live/pull/10) `cursor/initial-production-schema-e3d9`  
**Repository:** https://github.com/Shadesuk/Shadesuk-live  
**Date:** 2026-09-15  
**Scope:** Inventory env vars and config surfaces; record provider conflicts that Syed must lock before 3.3 data contracts. Docs only.

Companion: [`docs/PHASE3_REPO_AUDIT.md`](./PHASE3_REPO_AUDIT.md) (Phase 3.1, including Security appendix §12).

This document does **not** implement wiring, change app behaviour, or replace the approved frontend.

---

## 0. How to read this document

| Marker | Meaning |
| --- | --- |
| **Present** | Named in code, `.env.example`, or a live dashboard this audit could inspect. |
| **Expected** | Required by a locked spec or by a later 3.x slice, but not in the storefront env surface yet. |
| **Forbidden on `NEXT_PUBLIC_`** | Must never be inlined into the browser bundle. |
| **HUMAN LOCK-IN** | Syed must decide. This audit records options and impact; it does not pick. |
| **Not a lock** | Evidence (schema text, agent process env, Vercel project id) that must not be treated as a product decision. |

No secret values, API keys, or tokens are recorded here.

---

## 1. Env inventory

### 1.1 Used by storefront code on `main`

Literal `process.env.*` reads in application code:

| Variable | Where | Exposure | Role |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `src/lib/site.ts` | Public | `metadataBase`, sitemap, robots. Blank/invalid → `http://localhost:3000`. |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/config.ts` | Public | Project URL. Must be absolute `http(s)`. Secret key is not sent over plaintext remote http. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `src/lib/supabase/config.ts` | Public | Preferred browser/server publishable key. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/config.ts` | Public | Legacy alias if publishable key unset. |
| `SUPABASE_SECRET_KEY` | `src/lib/supabase/admin.ts` | **Server-only** | Preferred service-role / secret key. |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/admin.ts` | **Server-only** | Legacy alias if secret key unset. |
| `NODE_ENV` | `src/app/api/health/supabase/route.ts` | Implicit (Node/Next) | Production health response redaction. Not listed in `.env.example`. |

`next/font/google` Inter does **not** use a Google API key.

No other `process.env` reads exist in `src/`.

### 1.2 Documented in `.env.example`

| Variable | In example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes (local default) | Comments require it on Vercel Production, Preview, and Development. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (empty) | Example: `https://<project-ref>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes (empty) | Preferred. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Commented | Legacy. |
| `SUPABASE_SECRET_KEY` | Yes (empty) | Preferred. Marked SECRET. |
| `SUPABASE_SERVICE_ROLE_KEY` | Commented | Legacy. |

**Not in `.env.example`:** payment, OAuth, email, address autocomplete, analytics, webhook secrets, `NODE_ENV`, Vercel system vars, CLI tokens.

`.gitignore` ignores `.env*` except `.env.example`. This checkout has **no** `.env.local`.

### 1.3 Documented in README / prior PRs

| Source | What it documents |
| --- | --- |
| `README.md` | Copy `.env.example` → `.env.local`. Client / server / admin key split. `npx supabase@2.117.0` link workflow. `SUPABASE_ACCESS_TOKEN` for CLI login. States CLI is **not linked** and migrations must not be run from this checkout. |
| PR #4 | `NEXT_PUBLIC_SITE_URL` required on Vercel; empty string previously crashed `metadataBase`. Temporary value: current `https://<project>.vercel.app` until a canonical HTTPS domain exists. |
| PR #9 | Live project **Shadeslive** (`eu-central-1`). Both key generations enabled. Health probe behaviour. Project ref is the subdomain of `NEXT_PUBLIC_SUPABASE_URL` (documented in that PR / README; not repeated here). |

### 1.4 Spec documents (expected later; not coded)

| Spec | Env / config implication |
| --- | --- |
| Phase 3 handoff §19 | Stripe as payment provider; webhook secret server-side. |
| `sitemap.md` | Stripe payment UI later. |
| `src/types/integrations.ts` | `PaymentProvider.id: "stripe" \| string`; Google auth optional; address provider abstracted. |
| `SHADESUK_Database_Schema_RLS.md` | Razorpay + Resend named; Google OAuth; secrets in server env, never stored in Postgres. |
| `cart_checkout.md` | One payment provider, one address provider, abstracted; provider chosen at integration time; free/low-cost address tier preferred. |
| `account_order_tracking.md` / `sitemap.md` | Continue with Google; email/password; password reset. |
| `search.md` §19 | Analytics **platform can be selected later**; event names listed. |
| Handoff §79 | Analytics event contract; no vendor named. |
| Schema §41 | Storage buckets `product-images`, `collection-images`, `editorial-images` — dashboard/config, not Next env. |

`Development Roadmap.txt` is **missing** from the repo. Handoff Stripe wording cannot be confirmed from that file.

### 1.5 Implicit / platform env (not read by app code)

| Variable | Source | Used by app? |
| --- | --- | --- |
| `NODE_ENV` | Next.js / Node | Yes (health redaction). |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_*` | Vercel runtime | **No.** Site origin is `NEXT_PUBLIC_SITE_URL` only. Preview deployments will emit wrong canonical URLs if that var is a single production origin. |
| `SUPABASE_ACCESS_TOKEN` | CLI / agent | **No** storefront use. README mentions it for `npx supabase login`. |

### 1.6 This Cloud Agent process (not a product lock)

Names present in **this** agent runtime, values not recorded:

| Name | Storefront? | Notes |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | No | **Not a lock.** Schema-oriented name; unused by app. |
| `RAZORPAY_KEY_SECRET` | No | **Forbidden on `NEXT_PUBLIC_`.** Unused by app. Webhook secret was **not** present. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | No | Public key **name** only; unused. Do not treat as a decision to ship Razorpay on the client. |
| `SUPABASE_ACCESS_TOKEN` | No | Agent/CLI credential. |
| `SUPABASE_PROJECT_ID` | No | Agent/MCP project pointer; same project as PR #9 / README. **Not a storefront env var.** |

Stripe, Resend, Google OAuth, address, and analytics names were **unset** in this process. Absence here is also **not** a lock.

---

## 2. Hosting and backend configuration surfaces

### 2.1 Local

Expected file: `.env.local` (gitignored), copied from `.env.example`.

This checkout: no `.env.local`. Storefront Supabase/site vars are unset locally. `GET /api/health/supabase` would 503 until they are filled.

### 2.2 Vercel (assumed from GitHub integration; dashboard not readable here)

Observed from Vercel GitHub comments on PRs #10 and #11:

| Item | Value |
| --- | --- |
| Team | `shades3` |
| Project | `shadesuk-live` (`prj_BwCIdbC9OTUDQFmetaYxJsEYRcAD`) |
| Dashboard | https://vercel.com/shades3/shadesuk-live |
| Preview pattern | `shadesuk-live-git-<branch>-shades3.vercel.app` |
| `vercel.json` | **None** in repo |
| GitHub Actions | **None** |

PR #4 requires `NEXT_PUBLIC_SITE_URL` on Production, Preview, and Development. This audit **cannot** see whether Vercel actually has that var, or the Supabase keys, set.

**HUMAN LOCK-IN:** canonical production HTTPS origin (custom domain vs `*.vercel.app`). Until then, `metadataBase` / sitemap / robots / future OAuth redirects are provisional.

When Auth exists, each Preview URL must be allowed as a Supabase redirect (or previews will break Google/email links). That is a dashboard list, not a Next env var.

### 2.3 Supabase project (inspected)

| Item | Finding |
| --- | --- |
| Name | **Shadeslive** (ref = `NEXT_PUBLIC_SUPABASE_URL` subdomain; see PR #9) |
| Region | `eu-central-1` |
| Status | `ACTIVE_HEALTHY`, Postgres 17 |
| API URL | `https://<project-ref>.supabase.co` (same host as `NEXT_PUBLIC_SUPABASE_URL`) |
| Key generations | **Both** present: modern publishable (`sb_publishable_…`) and legacy anon JWT. Prefer publishable + secret in env. |
| CLI link in repo | **None.** No `supabase/` directory on `main`. |
| Edge Functions | **None** |
| Storage buckets | **None** (schema spec recommends three image buckets) |
| Auth users / identities | **0 / 0** |
| SSO / SAML providers in DB | **0** |
| Google OAuth | Not evidenced in Auth tables. Dashboard provider toggle is not visible via SQL. **HUMAN LOCK-IN** to enable Google in Supabase Auth + Google Cloud client. |
| Security advisor | Clean (no lints) at audit time |

**Migrations already applied on this project** (even though PR #10 is unmerged):

```text
20260914230750_initial_production_schema
20260914231056_optimize_foundation_indexes_and_rls
```

18 public tables, all RLS-enabled, **0 application rows**. Git `main` still has no `supabase/migrations/`.

Storefront code still does not query these tables.

### 2.4 Next.js config

`next.config.ts`: `reactStrictMode`, AVIF/WebP image formats. **No** `env` block, **no** `images.remotePatterns` for Supabase Storage. Live product images will need a remote pattern (or a loader) before `next/image` can serve Storage URLs. That is config, not an env var; flag for 3.4.

No `middleware.ts`.

---

## 3. Provider decisions Syed must lock before 3.3

3.3 data contracts cannot honestly encode payment columns, email provider strings, OAuth callbacks, or address DTOs until these are decided. **Do not silently pick.**

### D1. Payment provider — Stripe vs Razorpay — **HUMAN LOCK-IN**

| Source | Says |
| --- | --- |
| Handoff §19 | Roadmap specifies **Stripe**. Sensitive card data stays at the provider. |
| `sitemap.md` | **Stripe** payment UI later. |
| `src/types/integrations.ts` | Default id `"stripe"`. |
| `cart_checkout.md` | Frontend must not couple to one vendor; **one** provider in V1. |
| Schema spec | Named **Razorpay**; webhook + secret language is Razorpay-specific. |
| PR #10 SQL | `payments.provider` is unconstrained `text` (can store either). Payment status enum is Razorpay-shaped (`authorized` / `captured`). |
| This agent process | Razorpay **key names** present; Stripe names absent. **Not a lock.** |
| `Development Roadmap.txt` | **Missing** — cannot adjudicate. |

**Impact on 3.3:** webhook payload shape, env names, status mapping, checkout mount. Implement **one** abstraction; do not add a second provider “just in case.”

**Env surface once locked** (names are conventional, not invented as final):

If Stripe:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public)
- `STRIPE_SECRET_KEY` (**server**)
- `STRIPE_WEBHOOK_SECRET` (**server**)

If Razorpay:

- `NEXT_PUBLIC_RAZORPAY_KEY_ID` (public; name already seen in agent env)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (**server**)
- `RAZORPAY_WEBHOOK_SECRET` (**server**; **not** present in this agent process)

Webhook secrets are **Forbidden on `NEXT_PUBLIC_`**.

### D2. Email / transactional provider — **HUMAN LOCK-IN**

| Source | Says |
| --- | --- |
| Schema spec | **Resend**; `email_events.provider` documented as `resend`. |
| PR #10 | `email_events.provider` unconstrained `text`. |
| Handoff §104 | Test transactional emails; no vendor named. |
| App code / `.env.example` | Nothing. |

Supabase Auth can send its own signup/reset mail via dashboard SMTP. That is **separate** from order/dispatch Resend events.

**Expected env if Resend is locked:** `RESEND_API_KEY` (**server**), plus a from-address (`EMAIL_FROM` or equivalent — **not** coded). Confirm sending domain.

Password-reset “do not reveal whether email exists” is an Auth/UX rule, not an env var.

### D3. Google OAuth — **HUMAN LOCK-IN** (product intent is locked; credentials are not)

Locked UX: optional “Continue with Google”; never required to purchase (`account_order_tracking.md`, handoff §36).

Typical wiring is **Supabase Auth Google provider**, not a Next.js Google SDK:

- Google Cloud OAuth client id + secret → **Supabase dashboard** (not `NEXT_PUBLIC_` in the app).
- Redirect URLs: `{NEXT_PUBLIC_SITE_URL}/auth/callback` (exact path is an implementation detail for 3.7) plus localhost and each Vercel Preview origin, or a wildcard policy Syed accepts.
- `NEXT_PUBLIC_SITE_URL` must be the canonical HTTPS origin in production.

No Google client env in `.env.example`. Auth identities = 0. Enabling the provider is a dashboard action Syed (or whoever owns the Google Cloud project) must perform.

### D4. Address autocomplete — **HUMAN LOCK-IN**

Locked UX: abstracted lookup + mandatory manual fallback (`cart_checkout.md` §14–16). Vendor **explicitly deferred** to integration.

No provider named. No env names in repo. `AddressLookupProvider` is a type stub.

Candidates are **examples only** (Ideal Postcodes, getAddress.io, Loqate, Google Places). Do not treat this list as a recommendation of a winner.

Server-side lookup is preferable so the API key is not `NEXT_PUBLIC_`. If a vendor requires a browser key, restrict it by HTTP referrer and still keep a server path for checkout validation.

Also support browser autofill via `autocomplete` attributes (no env).

### D5. Analytics — **HUMAN LOCK-IN**

Event **names** are locked (handoff §79, `search.md` §19). Platform is not.

`search.md`: “Analytics platform can be selected later.”

No GA4 / GTM / PostHog / Meta package. No measurement ids.

Options include: none for V1, GA4, GTM wrapping GA4, or another tool. Public ids would be `NEXT_PUBLIC_*`. Do not send PII. Purchase events must be idempotent (handoff §81).

### D6. Is PR #10 schema canonical? — **HUMAN LOCK-IN**

| Fact | Detail |
| --- | --- |
| Git `main` | No `supabase/migrations/`. |
| PR #10 | Open, unmerged; two migrations. |
| Live project | Those two migrations **already applied**; 18 empty RLS tables. |
| Storefront | Does not query them. |
| 3.1 audit | Explicitly does not treat PR #10 as the live storefront contract until merged and mapped. |

**3.3 cannot start** without this lock. If PR #10 is canonical, 3.3 maps frontend `Product` onto `products` / `product_variants` (conflicts already listed in 3.1 §6.3). If it is not, say what is.

Related: CLI remains unlinked. Linking is operational, not a product lock, but 3.3 should not run ad-hoc dashboard DDL.

### D7. Fulfilment model (blocks 3.11 more than 3.3, still record now)

Handoff §27–30: China supplier + carrier abstraction. Schema V1: **manual** shipments, no supplier tables. No Royal Mail / carrier API env expected for V1 if schema wins.

**HUMAN LOCK-IN:** V1 = manual fulfil (schema) vs supplier API now (handoff). Affects whether 3.3 invents supplier entities.

### D8. Canonical site URL and indexation

`NEXT_PUBLIC_SITE_URL` exists; canonical domain does not. Root layout still `robots: { index: false }` except homepage override. Not a 3.3 blocker for types, but OAuth redirects and sitemap URLs need the production origin before Auth/SEO wiring.

---

## 4. Missing env surfaces (payment, OAuth, email, address, analytics)

Nothing below is in `.env.example` or app code. Names in *italics* are **illustrative** for the lock-in conversation, not committed API.

### 4.1 Payment — **missing**

| Need | Illustrative names | Exposure |
| --- | --- | --- |
| Public checkout key | *Stripe publishable* or *Razorpay key id* | Public |
| Server secret | *Stripe secret* or *Razorpay key secret* | **Server** |
| Webhook signing secret | *`STRIPE_WEBHOOK_SECRET` / `RAZORPAY_WEBHOOK_SECRET`* | **Server** |
| Mode / account | test vs live; GBP already hardcoded in PR #10 | Server / dashboard |

Also missing: webhook Route Handler URL to register at the provider (`/api/webhooks/…` does not exist).

### 4.2 OAuth / Auth — **missing** (mostly dashboard)

| Need | Surface |
| --- | --- |
| Google client id/secret | Supabase Auth provider settings |
| Site URL + additional redirect URLs | Supabase Auth URL config, driven by `NEXT_PUBLIC_SITE_URL` + preview origins |
| Email/password, reset, confirmation | Supabase Auth (built-in); optional custom SMTP |
| Session refresh | `middleware.ts` — **missing** (see Security appendix) |

No `GOOGLE_CLIENT_ID` in Next is required if Google is configured only in Supabase. Do not duplicate the Google secret into Vercel unless a non-Supabase Google SDK is chosen (**not** recommended by current specs).

### 4.3 Email — **missing**

| Need | Illustrative names | Exposure |
| --- | --- | --- |
| Transactional API key | *`RESEND_API_KEY`* if Resend locked | **Server** |
| From address / audience | *`EMAIL_FROM`* | Server |
| Auth mail | Supabase SMTP or default | Dashboard |

Frontend must never call the email API with a privileged key.

### 4.4 Address autocomplete — **missing**

| Need | Notes |
| --- | --- |
| Provider API key | Unknown until D4 |
| Optional `NEXT_PUBLIC_` browser key | Only if the vendor requires it; prefer server |
| Country bias | Spec is UK-first; may be code constant (`GB`) rather than env |

### 4.5 Analytics — **missing**

| Need | Notes |
| --- | --- |
| Measurement / container / project id | Vendor-specific `NEXT_PUBLIC_*` |
| Server secret (if any) | Forbidden on `NEXT_PUBLIC_` |

### 4.6 Other gaps (not in the user list; relevant)

| Gap | Notes |
| --- | --- |
| Guest cart session | PR #10 `carts.session_id`; likely an httpOnly cookie. May need a signing secret later. Do not invent the name now. |
| Guest tracking verification | Handoff §64; may need a hashing secret. Do not invent now. |
| Cron / admin job secret | If webhooks or fulfilment jobs are exposed as HTTP. |
| Storage | Buckets not created; `next.config` has no remote image host. |
| `SUPABASE_SECRET_KEY` on Vercel | Required before any trusted server path; unknown whether set. |

---

## 5. Conflicts (do not resolve here)

1. **Stripe vs Razorpay** — frontend/handoff vs schema/agent key names. See D1.
2. **Resend vs unspecified email** — schema names Resend; handoff does not. See D2.
3. **PR #10 applied remotely, unmerged in git** — two sources of schema truth. See D6.
4. **Manual V1 fulfilment vs handoff supplier chain** — see D7.
5. **Frontend `Product` vs DB product** — 3.1 §6.3; 3.3 work, not env, but blocked until D6.
6. **Missing `Development Roadmap.txt`** — payment/fulfilment intent cannot be closed from repo files.
7. **Single `NEXT_PUBLIC_SITE_URL` vs Vercel Preview hostnames** — OAuth and canonical URLs.

Recommended **engineering** posture until Syed locks: keep provider types abstract (`PaymentProvider`, `AddressLookupProvider`, `AuthProvider` already stubbed). Do not add SDKs.

---

## 6. Recommended decisions (advisory only — still HUMAN LOCK-IN)

These are the smallest decisions that unblock 3.3. They are **not** implemented and **not** final.

| ID | Advisory (Syed may override) | Why |
| --- | --- | --- |
| D1 | Pick **exactly one** payment provider in writing. Schema `provider` text can store the winner. Align status enum if Stripe is chosen (`authorized`/`captured` is Razorpay-like). | Wiring and env names diverge completely. |
| D2 | If no other vendor is preferred, treat **Resend** as the schema’s assumed transactional mailer — still confirm sending domain and Auth SMTP. | Avoid a second email table later. |
| D3 | Confirm Google OAuth **on** for V1 as specified; create the Google Cloud client; add production + localhost redirects in Supabase. Preview policy is a sub-decision. | Account spec is otherwise unblockable. |
| D4 | Name **one** UK address API with a free/low-cost tier, plus manual fallback (already locked). | Checkout 3.8. |
| D5 | Either name a V1 analytics vendor or explicitly defer events to a no-op logger until 3.16. | Stops 3.3 from inventing a `gtag` contract. |
| D6 | Confirm PR #10 **is** or **is not** canonical. If yes, merge it (or accept live DB + PR as source) before 3.3. | 3.3 maps types onto this schema. |
| D7 | Confirm V1 fulfilment = **manual** (schema) unless supplier APIs are in scope now. | Avoid fake supplier tables. |
| D8 | Set production `NEXT_PUBLIC_SITE_URL` to the real HTTPS origin; keep Preview strategy documented. | Auth + SEO. |

**Do not** invent live secrets into `.env.example` in this slice. After lock-in, 3.3+ should add **empty** placeholders and exposure comments only.

---

## 7. Security appendix (handoff §63) — env and config view

Full storefront-security write-up: [`PHASE3_REPO_AUDIT.md` §12](./PHASE3_REPO_AUDIT.md). Repeated here so 3.2 carries the same constraints into env/provider work.

### 7.1 §63 checklist vs current `main`

| Control | Result | Env / config note |
| --- | --- | --- |
| Secrets server-side | **PASS** (current) | Secret key non-`NEXT_PUBLIC_`; `admin.ts` is `server-only`. |
| No secrets in frontend bundle | **PASS** (current) | Only publishable/anon + site URL are public. Future payment/email/address secrets must follow the same rule. |
| Payment secrets protected | **N/A** | No payment env in `.env.example`. When D1 lands, webhook secret stays server-only. |
| Webhooks verified | **N/A** | No handler. Paid state must not be inferred from a return URL. |
| Authz server-side | **N/A** | No authenticated APIs. |
| Guest tracking protected | **N/A** | No route. See §7.3. |
| Admin endpoints protected | **N/A** | No admin HTTP surface. |
| Rate limits | **FAIL** on health; **N/A** elsewhere | Unauthenticated health has no throttle. |
| Sensitive errors/logs | **PASS** (prod health) | Production `{ ok, checkedAt }`; logs omit key material. |

### 7.2 Hard rule — admin client

**No unauthenticated Route Handler may return data sourced via `createSupabaseAdminClient` / service-role.**

Today: admin client unused. Health probes with the secret key but returns no schema data. Do not “fix” guest cart by exposing service-role reads on a public GET.

### 7.3 Guest tracking (§64)

Forbid `/order/[guessable-id]` as the sole access path. Require non-guessable reference **plus** verification, server-side, rate-limited. No env exists for this yet; do not invent a token secret name until 3.13 designs the mechanism.

### 7.4 Health oracle

`GET /api/health/supabase` is unauthenticated. Production redaction is OK; it remains an availability/config oracle. Do not expand it into a diagnostics dump. Optional later: auth, rate limit, or production-off.

### 7.5 Middleware / session gate

No `middleware.ts`. Required before `/account` or authenticated APIs. Guest checkout must remain available without a session. `NEXT_PUBLIC_SITE_URL` will feed Auth redirects; it is not itself a session gate.

### 7.6 Client-bundle catalogue — High at live cutover

`ProductCard` and `SearchForm` import catalogue/search services that close over `demoCatalogue`. **HIGH** before live rows exist: server search + RSC-provided product props. Not an env var; it is a configuration/architecture gate for 3.4.

### 7.7 Payment webhook trust

Order `payment_status` / customer “paid” UI only after **verified** provider webhook or equivalent server confirmation. Env implication: webhook secret is mandatory once D1 is locked; it never goes on `NEXT_PUBLIC_`.

---

## 8. Explicit lock-in list for Syed (before 3.3)

Copy/paste checklist. 3.3 should not start until these are answered in writing.

```text
[ ] D1 Payment provider: Stripe | Razorpay | other: ________
    - Test vs live mode: ________
    - Who owns the merchant account: ________

[ ] D2 Email: Resend | other: ________
    - From address / domain: ________
    - Auth mail: Supabase default | custom SMTP: ________

[ ] D3 Google OAuth: enable for V1? yes | no
    - Google Cloud project / client exists? ________
    - Production redirect origin: ________
    - Preview redirects: allowlist | skip Google on Preview: ________

[ ] D4 Address autocomplete vendor: ________
    - Server-side key vs browser key: ________
    - Confirm UK coverage + manual fallback remains: yes

[ ] D5 Analytics V1: none | GA4 | GTM | other: ________
    - Public id may be NEXT_PUBLIC_: yes | n/a

[ ] D6 PR #10 schema is canonical for 3.3? yes | no
    - If no, source of truth is: ________
    - Merge PR #10 before 3.3? yes | no

[ ] D7 V1 fulfilment: manual (schema) | supplier API now
    - If manual, defer 3.11 supplier tables: yes | no

[ ] D8 Canonical NEXT_PUBLIC_SITE_URL for production: ________
    - Confirm set on Vercel Production / Preview / Development: ________
    - Confirm Supabase URL + publishable + secret on Vercel: ________

[ ] Confirm: no second payment provider; no secrets in NEXT_PUBLIC_
    except publishable payment / analytics ids after lock-in.
```

---

## 9. What this slice did not do

- Did not add env vars, SDKs, middleware, webhooks, or Auth.
- Did not change `.env.example` (placeholders without a locked provider would invent names).
- Did not merge PR #10 or #11.
- Did not print or commit secret values.
- Did not treat Razorpay names in this agent process as Syed’s decision.
- Did not inspect the Vercel env dashboard (no access from this audit).
- Did not enable Google in Supabase Auth.

Approved frontend is unchanged.

---

## 10. Audit checklist (Phase 3.2)

- [x] Inventory env vars from code, `.env.example`, docs, Supabase, Vercel assumptions
- [x] Record provider decisions that must be locked before 3.3
- [x] List missing env surfaces: payment, OAuth, email, address autocomplete, analytics
- [x] Flag HUMAN LOCK-IN; do not invent secrets or final provider choices
- [x] Security appendix (§63/§64, admin-client rule, health oracle, middleware, client-bundle High, webhook trust)
- [x] Explicit Syed lock-in list
- [x] Docs only; approved frontend preserved

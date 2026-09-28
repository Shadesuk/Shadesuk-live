# PayPal replace Razorpay — Architecture (Phase 1)

**Status:** Architecture plan only. **Zero PayPal runtime code** in this phase.  
**Branch:** `cursor/paypal-replace-razorpay`  
**Inventory:** [PAYPAL_MIGRATION_PHASE0.md](./PAYPAL_MIGRATION_PHASE0.md)  
**Docs verified (authoritative):**

| Topic | Source |
| --- | --- |
| Orders v2 create / get / capture | https://developer.paypal.com/api/orders/v2 |
| Money (`currency_code`, `value` string) | https://developer.paypal.com/api/orders/v2/definitions/money |
| Currency codes (GBP supported; not zero-digit) | https://developer.paypal.com/reference/currency-codes |
| OAuth client credentials | https://developer.paypal.com/api/rest/authentication |
| JS SDK v6 setup (Client ID vs client token) | https://developer.paypal.com/sdk/js/set-up |
| Webhook verify (postback primary) | https://developer.paypal.com/api/rest/webhooks/rest |
| Webhook event names | https://developer.paypal.com/api/rest/webhooks/event-names |
| `custom_id` / `invoice_id` on purchase units | https://developer.paypal.com/api/orders/v2/definitions/purchase_unit_request |

Do **not** invent undocumented request fields. Prefer the documented shapes above.

---

## Non-negotiable constraints

- Feature branch only; never commit to `main`; no prod deploy / prod env / production DB activation.
- **GBP only.** App amounts stay **integer pence** (`*_minor`). No float currency math.
- Application capture **only** after authenticated **server** verification / reconciliation — never from browser redirect / `onApprove` alone.
- Preserve **one** capture writer seam (today `captureVerifiedRazorpayPayment` → `capture-store.capturePayment`). Rename/generalize to provider-neutral; do **not** add a second capture system.
- Map PayPal ids into existing `provider_order_id` / `provider_payment_id`. No duplicate order / payment / email systems.
- No secrets in the client. Only public **Client ID** may reach the browser (JS SDK Option A).
- No ghost Razorpay App Router archive. After PayPal cutover, **delete** `/api/webhooks/razorpay`.
- Checkout UI: swap Checkout.js → PayPal Buttons only as needed; no redesign.
- **Sandbox-first.** Live credentials stay documented placeholders; not activated in this work.

---

## 1. Target provider adapter interface

Mirror `src/lib/razorpay/*` under a future `src/lib/paypal/` (implementation = later phase).

| Module (planned) | Razorpay analogue | Responsibility |
| --- | --- | --- |
| `config.ts` | `razorpay/config.ts` | Resolve `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE`; pick API base URL |
| `client.ts` | `razorpay/client.ts` | OAuth2 client-credentials access token; authenticated REST calls |
| `create-order.ts` | `razorpay/create-order.ts` | `POST /v2/checkout/orders` with `intent: "CAPTURE"` |
| `fetch-order.ts` | `razorpay/fetch-payment.ts` | `GET /v2/checkout/orders/{id}` for reconcile |
| `capture-order.ts` | *(new — PayPal money capture)* | `POST /v2/checkout/orders/{id}/capture` — **provider** capture, not app finalization |
| `verify-client-return.ts` | `razorpay/verify-signature.ts` | Server-side reconcile after Buttons `onApprove` (no Razorpay-style HMAC on callback) |
| `verify-webhook-signature.ts` | `razorpay/verify-webhook-signature.ts` | Postback `POST /v1/notifications/verify-webhook-signature` (primary; no cert-download self-verify) |
| `amount.ts` | `razorpay/amount.ts` | Pence ↔ PayPal Money `value` string (integer math only) |
| `errors.ts` | `razorpay/errors.ts` | Redact secrets from logs |
| `open-buttons.ts` (client) | `razorpay/open-checkout.ts` | Load JS SDK v6 core script; start one-time payment session |

### Documented REST surfaces to use

| Step | Method / path | Host |
| --- | --- | --- |
| Access token | `POST /v1/oauth2/token` (`grant_type=client_credentials`) | Sandbox: `https://api-m.sandbox.paypal.com` · Live: `https://api-m.paypal.com` |
| Create order | `POST /v2/checkout/orders` | same |
| Show order | `GET /v2/checkout/orders/{id}` | same |
| Capture order | `POST /v2/checkout/orders/{id}/capture` | same |
| Verify webhook (postback) | `POST /v1/notifications/verify-webhook-signature` | same (`api-m.*`) |

### Create-order body (minimal documented shape)

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "amount": {
        "currency_code": "GBP",
        "value": "53.65"
      },
      "custom_id": "<payments.id UUID>",
      "invoice_id": "<orders.order_reference>"
    }
  ]
}
```

- `value` is a **string** (Money definition). GBP is not a zero-digit currency → use exactly **two** fractional digits derived from integer pence.
- `custom_id` (documented, max 255): our `payments.id` for reconcile / reports (not shown to payer).
- `invoice_id` (documented, max 127, uniqueness recommended per merchant): our `order_reference`. Open question if length / uniqueness rules conflict with existing references — see Security questions.

### Amount helpers (integer only)

App store: `amount_minor` = pence (e.g. `5365`).  
PayPal wire: `"53.65"`.

```
pence → value:  `${floor(pence/100)}.${pad(pence%100, 2)}`   // no float
value → pence:  parse /^\d+\.\d{2}$/ → major*100 + frac      // reject other shapes
```

Reject non-GBP `currency_code`. Never trust browser-supplied totals.

---

## 2. Env var names (document in `.env.example` later — do not set prod)

| Name | Client? | Purpose |
| --- | --- | --- |
| `PAYPAL_CLIENT_ID` | **Public** (may reach browser / initiation action return) | REST app Client ID; JS SDK `createInstance({ clientId })` |
| `PAYPAL_CLIENT_SECRET` | Server only | OAuth token exchange; never `NEXT_PUBLIC_` |
| `PAYPAL_WEBHOOK_ID` | Server only | Webhook subscription id required for **postback** signature verification. **Not** a Razorpay-style shared HMAC secret |
| `PAYPAL_MODE` | Server (and indirectly which SDK script URL) | `sandbox` \| `live`. Selects API host + JS SDK script host |

**Placeholders only** for live in `.env.example` comments. Sandbox values may be used in local/preview later; **live not activated** in this migration work.

**Explicit non-names:** Do not add `NEXT_PUBLIC_PAYPAL_CLIENT_SECRET` or `NEXT_PUBLIC_PAYPAL_CLIENT_ID`. Client ID reaches the browser only via the initiation Server Action return (same pattern as Razorpay `publicKeyId`).

**JS SDK script hosts (documented):**

- Sandbox: `https://www.sandbox.paypal.com/web-sdk/v6/core`
- Live: `https://www.paypal.com/web-sdk/v6/core`

---

## 3. Id mapping

| SHADESUK column | PayPal field | When written |
| --- | --- | --- |
| `payments.provider` | literal `"paypal"` | Pending insert (`pending-attempt`) |
| `payments.provider_order_id` | Orders v2 **order** `id` | After successful create-order (`attachProviderOrderId`) |
| `payments.provider_payment_id` | **Capture** `id` at `purchase_units[].payments.captures[].id` | After server capture reconcile / webhook recovery (`capturePayment`) |
| `purchase_units[].custom_id` | `payments.id` | On create-order (correlate webhook/resource if present) |
| `purchase_units[].invoice_id` | `orders.order_reference` | On create-order (payer-visible; keep unique) |

Webhook `PAYMENT.CAPTURE.COMPLETED` resource (documented example):

- `resource.id` → capture id → `provider_payment_id`
- `resource.supplementary_data.related_ids.order_id` → order id → match `provider_order_id`
- `resource.amount.{currency_code,value}` → must equal stored GBP minor after conversion

Do **not** store PayPal payer ids or access tokens on `payments`.

---

## 4. Checkout UI flow (Buttons vs Checkout.js)

### Today (Razorpay)

1. `initiateCheckoutPaymentAction` → pending rows + Razorpay order → returns `providerOrderId` + `publicKeyId`
2. `CheckoutReview` → Checkout.js (`openRazorpayCheckout`)
3. Callback → `verifyCheckoutPaymentAction` (HMAC + fetch payment) → `captureVerifiedRazorpayPayment`

### Target (PayPal JS SDK v6 — documented Option A Client ID)

1. Same initiation seam (rename Razorpay-specific names later): persist unpaid order/payment → **create PayPal order** → attach `provider_order_id` → return `{ paymentId, providerOrderId, clientId, amountMinor, currency }`
2. `CheckoutReview` loads v6 core script for current `PAYPAL_MODE`, `createInstance({ clientId, components: ["paypal-payments"], pageType: "checkout" })`, eligibility check with `currencyCode: "GBP"`, render PayPal button / session only.
3. Session `createOrder` callback returns **already-created** `{ orderId: providerOrderId }` from initiation (do not create a second PayPal order from the browser; do not pass amounts from the client).
4. `onApprove({ orderId })` → Server Action (verify + **server** `POST .../capture` + amount/status reconcile) → **same** `captureVerifiedPayment` writer.
5. Dismiss / cancel / error → unpaid rows remain; webhook may still recover if PayPal later completes a capture.

**Client token:** Official v6 docs reserve client-token auth for **Fastlane**. Standard Buttons use **Client ID**. Do not add browser-safe client-token endpoints unless Fastlane is explicitly in scope later.

**Forbidden:** Client-side `actions.order.capture()` (legacy) or trusting redirect query params alone to mark `captured`.

---

## 5. Webhook route plan

| Item | Plan |
| --- | --- |
| New route | `POST /api/webhooks/paypal` → `src/app/api/webhooks/paypal/route.ts` |
| Raw body | `request.text()` before JSON parse (required for postback `webhook_event` fidelity) |
| Headers | Documented: `paypal-transmission-id`, `paypal-transmission-time`, `paypal-transmission-sig`, `paypal-cert-url`, `paypal-auth-algo` (passed through to postback verify) |
| Verify | **Locked to postback:** OAuth → `POST /v1/notifications/verify-webhook-signature` with `PAYPAL_WEBHOOK_ID` + transmission headers + raw `webhook_event`. Cert-download / CRC32 **self-verify is out of scope / not used** (avoids reintroducing SSRF via `paypal-cert-url` fetch). |
| Config | `PAYPAL_WEBHOOK_ID` from subscription in Application management |
| Primary event | `PAYMENT.CAPTURE.COMPLETED` → resolve payment → amount check → `captureVerifiedPayment` |
| Decline / fail | `PAYMENT.CAPTURE.DECLINED` (and similar) → mark failed paths if already modeled; do not capture |
| **Do not capture on** | `CHECKOUT.ORDER.APPROVED` alone (buyer approved; funds not necessarily captured) |
| Idempotency | Reuse existing capture idempotency (`status` / `captured_at` / unique `provider_payment_id`) |
| Retire Razorpay | After PayPal cutover + verifies green: **delete** `src/app/api/webhooks/razorpay/route.ts` and Razorpay webhook handler wiring. **No** ghost/archive route |

---

## 6. Contract / type changes

| Location | Change |
| --- | --- |
| `src/contracts/payment/schema.ts` | Replace lock: `PAYMENT_PROVIDER_PAYPAL = "paypal"`; `PaymentProviderId`; `isPaymentProviderPaypal` (remove or deprecate Razorpay constants in same hard-cut PR) |
| `src/contracts/index.ts` | Re-export new symbols |
| `src/types/integrations.ts` | `PaymentProvider.id: "paypal"` |
| `src/lib/payment/pending-attempt.ts` | Build attempts with `provider: PAYMENT_PROVIDER_PAYPAL` |
| `capture-store` / `webhook-store` / verify paths | `.eq("provider", PAYMENT_PROVIDER_PAYPAL)` |
| Capture entry | Rename `captureVerifiedRazorpayPayment` → `captureVerifiedPayment` (provider-neutral verified input) |
| Presentation | `src/lib/payment-methods.ts` stays marks-only; no SDK |

Schema columns stay provider-opaque (`provider` text + id columns). No migration required for id storage.

---

## 7. Cutover strategy — **hard cut** (recommended)

**Recommend: hard cut on the feature branch** (replace Razorpay end-to-end in one mergeable series), not a dual-run flag.

Rationale:

- Capture/webhook stores already filter a **single** locked provider (`PAYMENT_PROVIDER_RAZORPAY`). Dual-run needs parallel predicates, dual env, and dual client SDKs without a second-provider schema story.
- Contracts explicitly lock one production provider (“Do not add a second provider adapter”).
- Storefront is not mid-flight dual-charging in prod under this work; sandbox-first hard cut is safer than a half-flagged dual path.
- Rollback = tag `pre-paypal-35e7153` + revert merge; no ghost routes.

Temporary dual-run only if Security Audit requires live shadow traffic — default remains hard cut.

---

## 8. Failure / idempotency / races

| Scenario | Handling |
| --- | --- |
| Double capture (client verify + webhook) | First writer wins via `capture-store` filters (`status in created\|authorized`, `captured_at is null`, matching `provider_order_id`, payment id null-or-equal). Second path returns `already_captured`. |
| Webhook before client returns | Webhook verifies signature, loads by `provider_order_id` / capture id, captures via same writer. Client verify then sees already captured → confirmation redirect. |
| Client approve but Capture API fails | Do not mark SHADESUK captured. Leave pending; webhook / retry may complete later. Surface error in CheckoutReview. |
| Amount / currency mismatch | Reject before capture writer (create-order response, GET order, Capture response, webhook resource). |
| Capture `COMPLETED` but wrong `custom_id` | Prefer `provider_order_id` match; treat `custom_id` as secondary check when present. |
| Buyer cancels Buttons | No capture; unpaid `orders`/`payments` remain (same as Razorpay dismiss). |
| Replay webhook | Signature ok + already captured → 200 idempotent ack (PayPal retries on non-2xx). |
| Browser-only trust | Forbidden: never set `captured` from `onApprove` without server Capture + reconcile. |

PayPal “capture” (REST) ≠ SHADESUK “captured” row — always: provider Capture success → then app capture writer.

---

## 9. Verify-script update plan

| Script / npm | Update |
| --- | --- |
| `scripts/verify-payment-foundation.ts` (`verify:payment`) | PayPal env names, `src/lib/paypal/*` presence, provider lock `paypal`, no Checkout.js in server modules |
| `scripts/verify-payment-verification.ts` (`verify:payment-verify`) | Client-return reconcile + amount helpers; forbid secrets / Checkout.js |
| `scripts/verify-payment-capture.ts` (`verify:payment-capture`) | Provider-neutral `captureVerifiedPayment`; store filters `paypal` |
| `scripts/verify-payment-webhook.ts` (`verify:payment-webhook`) | PayPal route + signature headers + `PAYMENT.CAPTURE.COMPLETED` |
| `scripts/verify-payment-final.ts` (`verify:payment-final`) | End-to-end lock: webhook path `/api/webhooks/paypal`, env allowlist, no Razorpay leftovers |
| `scripts/verify-checkout.ts` (`verify:checkout`) | CheckoutReview uses PayPal Buttons helper; no Checkout.js / `@razorpay` |
| Admin verifies (`verify-admin-*.ts`) | Continue asserting admin surfaces do not embed payment SDKs (string checks → `paypal`/`razorpay` as appropriate) |
| `package.json` | Later: remove `razorpay` dep; add PayPal server client only if chosen (or raw `fetch` — open question) |

---

## 10. Out of scope + STOP gate before prod

### Out of scope (this architecture and subsequent coding phases until STOP clears)

- Live credential activation / production Dashboard webhook subscription cutover
- Production DB backfill or rewriting historical `provider=razorpay` rows
- Fastlane / Venmo / Apple Pay / Google Pay / Advanced Card Fields (unless already covered by PayPal Buttons eligibility with no extra UI redesign)
- Refunds, disputes, partial captures, `AUTHORIZE` intent
- Ghost Razorpay archive routes
- Broad UI / brand redesign
- Dual-provider feature flags (unless Audit overrides §7)

### STOP gate (must pass before prod)

1. Sandbox end-to-end: initiate → Buttons approve → server Capture → app captured → confirmation email path.
2. Webhook recovery path tested with signed sandbox events (not mock-only if postback verify is used — mocks skip postback per docs).
3. Verify suite green (`verify:payment*`, `verify:checkout`, `verify:payment-final`).
4. Razorpay route **deleted**; no secret Razorpay env required for boot.
5. Security (Audit) design review signed off on open questions below.
6. Explicit human approval to set **live** `PAYPAL_*` and `PAYPAL_MODE=live` in the host — **not** part of agent work.

---

## Open questions — Security (Audit) design review

Do **not** implement until reviewed:

1. **Webhook verify method:** **Resolved — postback locked.** Primary path is `POST /v1/notifications/verify-webhook-signature`. Self-verify (cert URL + CRC32) is **out of scope / not used** so SSRF cert-fetch is not reintroduced. Mock simulator events cannot use postback verify — use real sandbox Dashboard events.
2. **`paypal-cert-url`:** Header is forwarded to postback only; no app-side cert download / allowlist needed while self-verify stays unused.
3. **Client ID delivery:** **Resolved — action-return only.** Do not add `NEXT_PUBLIC_PAYPAL_CLIENT_ID`. Confirm CSP `script-src` for `www.sandbox.paypal.com` / `www.paypal.com` / `web-sdk`.
4. **`invoice_id` = `order_reference`:** Confirm length ≤ 127 and merchant uniqueness vs existing reference format; else use opaque unique invoice and keep reference only in `custom_id` / metadata-less columns.
5. **Capture race policy:** Always call Capture from client-return path even if webhook may win; confirm double-Capture API behavior is treated as reconcile-via-GET, not error storm.
6. **Pending unpaid rows:** Retention / customer-visible behaviour for abandoned PayPal approvals (already unpaid `placed` orders today).
7. **Server HTTP client:** Official PayPal Server SDK vs raw `fetch` + OAuth — supply-chain and secret-handling preference.
8. **Webhook event subscription set:** Minimum `PAYMENT.CAPTURE.COMPLETED` + declined/failed; confirm whether `CHECKOUT.PAYMENT-APPROVAL.REVERSED` needs operational alerting (documented uncaptured-after-approve case).
9. **Historical rows:** Leave old `provider=razorpay` payments untouched vs read-only admin labelling.
10. **Live cutover checklist ownership:** Who flips `PAYPAL_MODE`, Dashboard webhook URL, and removes Razorpay Dashboard webhooks — outside agent scope.

---

## Implementation phase map

| Phase | Work |
| --- | --- |
| **0** | Inventory + branch/tag — done |
| **1** | Architecture — done (docs) |
| **2** | Adapter + contracts + env example + capture rename — done ([PAYPAL_MIGRATION_PHASE2.md](./PAYPAL_MIGRATION_PHASE2.md)) |
| **3** | CheckoutReview Buttons UI — done ([PAYPAL_MIGRATION_PHASE3.md](./PAYPAL_MIGRATION_PHASE3.md)); mode-aware CSP |
| **4** | PayPal webhook + delete Razorpay webhook route — done ([PAYPAL_MIGRATION_PHASE4.md](./PAYPAL_MIGRATION_PHASE4.md)) |
| **5** | Verify scripts + remove `razorpay` package / `src/lib/razorpay` — **done** ([PAYPAL_MIGRATION_PHASE5.md](./PAYPAL_MIGRATION_PHASE5.md)) |
| **STOP** | Audit + human prod gate (Syed / CoS) |

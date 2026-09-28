# PayPal replace Razorpay — Phase 0 inventory

**Status:** Phase 0 inventory complete. Phase 1 architecture: [PAYPAL_MIGRATION_ARCHITECTURE.md](./PAYPAL_MIGRATION_ARCHITECTURE.md) (docs only — still no PayPal runtime).  
**Base commit:** `35e71531061360ebd15dc39852f3f5e25c0b4c39`  
**Branch:** `cursor/paypal-replace-razorpay`  
**Rollback tag:** `pre-paypal-35e7153` (annotated)

## Capture / order-finalization writer

| Concern | Path | Notes |
| --- | --- | --- |
| Application capture entry | `src/lib/payment/capture-verified.ts` | `captureVerifiedRazorpayPayment` — sole path that finalizes after server verify |
| DB capture writer | `src/lib/payment/capture-store.ts` | `capturePayment` sets `status=captured`, `captured_at`, **`provider_payment_id`**; filters on `provider=razorpay` + `provider_order_id` |
| Order payment_status | same store | `markOrderPaymentCaptured` → `orders.payment_status=captured` |
| Post-capture side effects | `src/lib/payment/after-captured.ts` | Email/notify after commit; must not un-capture |

### How provider ids are written

1. **`provider_order_id`** — set at initiation after Razorpay order create: `src/lib/payment/pending-store.ts` → `attachProviderOrderId` (called from `src/lib/payment/initiate.ts` / `commitPendingRazorpayPayment`). Insert starts with both ids `null`.
2. **`provider_payment_id`** — may be attached early in verify via `src/lib/payment/verification-store.ts` → `attachProviderPaymentId`; definitive write on capture in `capture-store.capturePayment`.
3. Webhook path resolves payment by `provider_order_id` / `provider_payment_id` (`src/lib/payment/webhook-store.ts`) then still calls `captureVerifiedRazorpayPayment`.

## Active Razorpay runtime inventory

### Adapter / SDK (`src/lib/razorpay/`)

| File | Role |
| --- | --- |
| `config.ts` | Env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| `client.ts` | Server Razorpay SDK client |
| `create-order.ts` | Create provider order |
| `fetch-payment.ts` | Fetch payment for verify |
| `verify-signature.ts` | Checkout callback HMAC |
| `verify-webhook-signature.ts` | Webhook HMAC |
| `amount.ts` | Subunit → GBP minor |
| `errors.ts` | Secret redaction |
| `open-checkout.ts` | **Checkout.js** (`https://checkout.razorpay.com/v1/checkout.js`) |

npm dep: `razorpay` in `package.json`.

### Client Checkout.js UI

- `src/components/checkout/CheckoutReview.tsx` — loads Checkout.js via `openRazorpayCheckout`, then `verifyCheckoutPaymentAction`

### Server Actions / API

- `src/app/(storefront)/checkout/payment-actions.ts` — `initiateCheckoutPaymentAction`, `verifyCheckoutPaymentAction`
- `src/app/api/webhooks/razorpay/route.ts` — `POST /api/webhooks/razorpay`
- `src/services/pending-payment.ts` — initiation orchestration → `createRazorpayOrder`

### Payment domain (provider-locked)

- `src/lib/payment/initiate.ts`
- `src/lib/payment/pending-attempt.ts` — builds attempt with `provider: razorpay`
- `src/lib/payment/pending-store.ts`
- `src/lib/payment/verify-checkout.ts`
- `src/lib/payment/verification-store.ts`
- `src/lib/payment/handle-webhook.ts` — events `payment.captured` / `payment.failed`
- `src/lib/payment/webhook-store.ts`
- `src/lib/payment/capture-verified.ts`
- `src/lib/payment/capture-store.ts`
- `src/lib/payment/after-captured.ts`

### Contracts / predicates / presentation

- `src/contracts/payment/schema.ts` — `PAYMENT_PROVIDER_RAZORPAY = "razorpay"`, `isPaymentProviderRazorpay`, `PaymentRow`
- `src/contracts/payment/stub.ts`
- `src/contracts/index.ts` — re-exports
- `src/types/integrations.ts` — `PaymentProvider.id: "razorpay"`
- `src/lib/payment-methods.ts` — marks UI only (Visa/MC/Amex); no SDK

### Env names (`.env.example`)

- `RAZORPAY_KEY_ID` (public key returned only after server initiation — **not** `NEXT_PUBLIC_`)
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

### Verify scripts / npm scripts

- `scripts/verify-payment-foundation.ts` → `verify:payment`
- `scripts/verify-payment-verification.ts` → `verify:payment-verify`
- `scripts/verify-payment-capture.ts` → `verify:payment-capture`
- `scripts/verify-payment-webhook.ts` → `verify:payment-webhook`
- `scripts/verify-payment-final.ts` → `verify:payment-final`
- `scripts/verify-checkout.ts` — asserts Checkout.js only in CheckoutReview / `src/lib/razorpay`
- Admin verify scripts assert storefront admin surfaces do not embed razorpay (`verify-admin-*.ts`)

### Schema (read-only note)

- `supabase/migrations/20260914230750_initial_production_schema.sql` — `payments.provider_order_id` / `provider_payment_id` unique text columns
- `SHADESUK_Database_Schema_RLS.md` — documents `razorpay` as provider

## Plan stub (later phases)

1. **Phase 1** — Architecture — **done** (see [PAYPAL_MIGRATION_ARCHITECTURE.md](./PAYPAL_MIGRATION_ARCHITECTURE.md)). Hard cut recommended; one capture writer seam.
2. **Phase 2** — Adapter + contracts + env example placeholders + rename capture entry (sandbox only).
3. **Phase 3** — Replace Checkout.js with PayPal JS SDK v6 Buttons in CheckoutReview; map ids into existing columns.
4. **Phase 4** — `POST /api/webhooks/paypal`; delete `/api/webhooks/razorpay` after cutover (no ghost archive).
5. **Phase 5** — Update verify scripts; remove `razorpay` npm dep + `src/lib/razorpay`.
6. **Out of scope until STOP gate** — prod env / live credentials / production DB activation.

## Explicit non-goals (this PR)

- No PayPal implementation
- No deploy / prod env / production DB
- No ghost Razorpay archive routes
- No UI redesign beyond inventory docs

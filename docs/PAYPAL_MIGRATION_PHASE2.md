# PayPal migration — Phase 2 landed

**Branch:** `cursor/paypal-replace-razorpay`  
**Parent plan:** [PAYPAL_MIGRATION_ARCHITECTURE.md](./PAYPAL_MIGRATION_ARCHITECTURE.md)

## What landed (Phase 2)

- `src/lib/paypal/*` — config, client (OAuth + raw `fetch`), create-order, fetch-order, capture-order, verify-client-return, verify-webhook-signature (postback-oriented), amount, errors, open-buttons (**stub**, no CheckoutReview Buttons UI yet)
- Contracts hard-cut: `PAYMENT_PROVIDER_PAYPAL` / `isPaymentProviderPaypal`; `integrations.ts` → `paypal`
- Capture writer renamed: `captureVerifiedPayment` (alias kept for transition); `capture-store` filters `provider=paypal`
- Initiation: `commitPendingPayPalPayment` / `initiatePendingPayPalPayment` → PayPal create-order with `custom_id=payments.id`, `invoice_id=order_reference` (fail closed if `invoice_id` length > 127)
- Server Actions return public `clientId` (not secret); verify path calls server Capture + reconcile before app capture
- `.env.example`: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE`; Razorpay vars commented retired
- Razorpay webhook route kept but **fails closed** (503) until Phase 4 deletes it — no ghost archive

## Audit locks applied

1. Webhook verify = postback stub (`/v1/notifications/verify-webhook-signature`); no cert-download primary path  
2. Client-return = server Capture + amount reconcile (GET if already captured) before `captureVerifiedPayment`  
3. `invoice_id` length ≤ 127 or create-order rejects (never truncate)  
4. Client ID via initiation action-return only  
5. Raw `fetch` + OAuth (no official PayPal Server SDK)  
6. Hard cut to `paypal` provider lock; historical DB rows untouched  
7. GBP pence ↔ Money `value` with exactly two fractional digits  
8. One capture writer  
9. Env placeholders only in `.env.example`  
10. Id map: order id → `provider_order_id`; capture id → `provider_payment_id`

## Intentional temporary gap (until Phase 3) — closed

Phase 3 wires real PayPal JS SDK v6 Buttons (`openPayPalButtons`). See [PAYPAL_MIGRATION_PHASE3.md](./PAYPAL_MIGRATION_PHASE3.md).

## Typecheck note

`scripts/` is excluded from `tsconfig.json` until Phase 5 rewrites `verify-payment-*.ts` for PayPal. App/`src` typecheck and `next build` must pass without those scripts. Do not treat exclusion as permanent.

## Not in Phase 2

- PayPal Buttons UI wiring → Phase 3  
- `POST /api/webhooks/paypal` → Phase 4  
- Deleting `src/lib/razorpay` / npm `razorpay` / Checkout.js helper → Phase 5  
- Live credentials / prod deploy  
- Verify-script rewrites (Phase 5)

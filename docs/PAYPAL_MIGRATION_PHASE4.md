# PayPal migration — Phase 4 landed

**Branch:** `cursor/paypal-replace-razorpay`  
**Parent:** [PAYPAL_MIGRATION_PHASE3.md](./PAYPAL_MIGRATION_PHASE3.md)

## What landed

- **New** `POST /api/webhooks/paypal` → `src/app/api/webhooks/paypal/route.ts`
- **Deleted** `src/app/api/webhooks/razorpay/` (no ghost/archive route)
- `handlePayPalWebhook` in `src/lib/payment/handle-webhook.ts`
- `createSupabasePaymentWebhookStore` (paypal provider) in `webhook-store.ts`
- Signature verify: postback `verifyPayPalWebhookSignature` → `POST /v1/notifications/verify-webhook-signature` with `PAYPAL_WEBHOOK_ID`

## Signature verify invocation

1. Route reads **raw** body via `request.text()` (before JSON parse).
2. Reads headers: `paypal-transmission-id`, `paypal-transmission-time`, `paypal-transmission-sig`, `paypal-cert-url`, `paypal-auth-algo`.
3. `handlePayPalWebhook` requires `PAYPAL_WEBHOOK_ID` (else **503** — never skip verify).
4. Calls `verifyPayPalWebhookSignature` which OAuth-auths then POSTs the raw-parsed `webhook_event` + headers + `webhook_id` to PayPal’s verify endpoint. Success only when `verification_status === SUCCESS`.
5. **No** cert-download self-verify primary path.

## Event handling

| Event | Behaviour |
| --- | --- |
| `PAYMENT.CAPTURE.COMPLETED` | Amount/currency reconcile (GBP pence) → `captureVerifiedPayment`. Idempotent `already_captured` → **200** |
| `PAYMENT.CAPTURE.DECLINED` / `DENIED` | `markPaymentFailed` if unpaid row found; never capture |
| `CHECKOUT.ORDER.APPROVED` | Ack / mark processed only — **never** app-capture |
| `CHECKOUT.PAYMENT-APPROVAL.REVERSED` | Structured `console.info` log only; mark processed |
| Other | Mark processed (ack) without capture |

## Sandbox webhook URL

PayPal only delivers to **HTTPS :443** reachable hosts. For sandbox:

1. Deploy a preview / use a tunnel to this branch’s `/api/webhooks/paypal`.
2. In PayPal Developer Dashboard → app → Webhooks, subscribe to at least `PAYMENT.CAPTURE.COMPLETED` (plus declined/denied + optional approval-reversed for ops).
3. Copy the subscription **Webhook ID** into `PAYPAL_WEBHOOK_ID`.
4. Mock simulator events **cannot** use postback verify — use real sandbox app events.

## Env

`PAYPAL_WEBHOOK_ID` is required for verify on real traffic (documented in `.env.example`).

## Not in Phase 4

- Full verify-script rewrites / remove `src/lib/razorpay` (Phase 5)
- Live credentials / prod Dashboard cutover / merge

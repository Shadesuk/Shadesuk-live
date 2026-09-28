# PayPal migration — Phase 5 landed

**Branch:** `cursor/paypal-replace-razorpay`  
**Parent:** [PAYPAL_MIGRATION_PHASE4.md](./PAYPAL_MIGRATION_PHASE4.md)

## What landed

- Rewrote `scripts/verify-payment-*.ts` + PayPal locks in `scripts/verify-checkout.ts`
- Admin verifies forbid PayPal/Razorpay SDK embedding on admin surfaces
- Re-included `scripts/` in `tsconfig.json` (Phase 2 temporary exclusion undone)
- Removed npm `razorpay` and deleted `src/lib/razorpay/*`
- Purged dead Razorpay imports/aliases; historical `payments.provider=razorpay` rows stay as-is (no backfill)
- `verify:payment-final` asserts: webhook path paypal, Razorpay route absent (no ghost archive), secrets not embedded in client, provider lock paypal

## Verify commands run (no live PayPal credentials)

| Command | Result |
| --- | --- |
| `npm run verify:payment` | ok |
| `npm run verify:payment-verify` | ok |
| `npm run verify:payment-capture` | ok |
| `npm run verify:payment-webhook` | ok (postback network skipped) |
| `npm run verify:payment-final` | ok |
| `npm run verify:checkout` | ok |
| `npm run verify:admin-orders` / `products` / `collections` / `customers` / `ops` | ok |
| `npx tsc --noEmit` | ok |
| `npm run build` | ok (`/api/webhooks/paypal` only; Razorpay route absent) |

`verify:payment-webhook` injects `verifySignature` — it does **not** call PayPal’s postback network API.

### Sandbox network (skipped — needs human credentials)

```bash
# Requires reachable HTTPS + PAYPAL_WEBHOOK_ID from Dashboard subscription
# POST real sandbox events to /api/webhooks/paypal
# Also: sandbox Buttons E2E with PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_MODE=sandbox
```

## STOP gate (for Syed / CoS — not agent)

1. Sandbox E2E Buttons + webhook delivery with real Dashboard `PAYPAL_WEBHOOK_ID`
2. Security / specialist reviews as CoS dispatches
3. Explicit human approval before **live** `PAYPAL_*` / `PAYPAL_MODE=live` / production Dashboard webhook URL
4. Do **not** merge this PR as a silent prod cutover without that approval

## Out of scope (still)

- Merge to main / prod deploy / live credential activation
- Historical `payments.provider=razorpay` backfill (rows stay as-is)
- Specialist reviews (CoS dispatches after this phase)

## PR Review follow-ups

### HIGH — addressed

`isAlreadyCapturedError` in `src/lib/paypal/capture-order.ts` no longer treats bare HTTP **422/409** as already-captured. It matches only the documented Orders v2 issue code **`ORDER_ALREADY_CAPTURED`** in `details[].issue` ([PayPal errors overview](https://developer.paypal.com/api/errors/overview)). Other 422 issues (e.g. `CARD_EXPIRED`, `ORDER_NOT_APPROVED`) fail closed without GET-reconcile.

### MEDIUM — deferred (known risks)

- Initiation idempotency remains `PAYMENT_ATTEMPT_IDEMPOTENCY.mechanism = "none"` (no draft/session payment-attempt key).
- Inventory decrement after capture stays best-effort.

### Audit polish N2 / N5 (non-blocking)

- **N2:** Architecture doc locks webhook verify to **postback** `verify-webhook-signature`; self-verify / cert-download marked out of scope (no SSRF cert-fetch).
- **N5:** `.env.example` no longer suggests optional `NEXT_PUBLIC_PAYPAL_CLIENT_ID` — Client ID is initiation Server Action return only.
- Skipped N1 / N3 / N4 (deferred).

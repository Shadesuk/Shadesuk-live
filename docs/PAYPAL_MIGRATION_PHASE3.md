# PayPal migration — Phase 3 landed

**Branch:** `cursor/paypal-replace-razorpay`  
**Parent:** [PAYPAL_MIGRATION_PHASE2.md](./PAYPAL_MIGRATION_PHASE2.md) · [PAYPAL_MIGRATION_ARCHITECTURE.md](./PAYPAL_MIGRATION_ARCHITECTURE.md)

## What landed

- Real PayPal JS SDK **v6** Buttons flow in `src/lib/paypal/open-buttons.ts`
- `CheckoutReview` uses initiation `{ clientId, providerOrderId, paymentId, mode }` — no Checkout.js
- Initiation Server Action returns `mode` from `PAYPAL_MODE` (sandbox|live) for script host selection
- `createOrder` returns already-created `{ orderId: providerOrderId }` only — no second order, no client amounts
- `onApprove` → `verifyCheckoutPaymentAction` → server Capture + reconcile → `captureVerifiedPayment`
- Cancel → unpaid + cancelled UX; SDK/eligibility errors → clear inline error
- Mode-aware CSP via `src/lib/paypal/csp.ts` + `next.config.ts` `headers()`

## CSP (mode-aware)

| Mode | Primary hosts |
| --- | --- |
| `sandbox` (default if unset) | `www.sandbox.paypal.com`, `*.sandbox.paypal.com`, `api-m.sandbox.paypal.com`, `www.paypalobjects.com`, `*.paypalobjects.com` |
| `live` | `www.paypal.com`, `*.paypal.com`, `api-m.paypal.com`, + objects CDN |

Directives covered: `script-src`, `style-src`, `img-src`, `connect-src`, `frame-src`, `child-src`, `form-action`.  
Also allows `'self'`, Next-friendly `'unsafe-inline'` / `'unsafe-eval'` (nonce hardening = later). Supabase origin added to `connect-src` when `NEXT_PUBLIC_SUPABASE_URL` is set. **No Razorpay Checkout.js hosts.**

## Manual sandbox smoke test

1. Set in `.env.local` (sandbox app from PayPal Developer Dashboard):
   - `PAYPAL_CLIENT_ID=...`
   - `PAYPAL_CLIENT_SECRET=...`
   - `PAYPAL_MODE=sandbox`
   - `PAYPAL_WEBHOOK_ID=` (optional until Phase 4)
2. `npm run dev` → add bag items → `/checkout` through Review
3. Continue to payment → PayPal sandbox UI should open (personal sandbox buyer)
4. Approve → server capture → confirmation page
5. Cancel PayPal UI → stay on review with cancelled copy; order remains unpaid
6. Confirm Network tab: script from `www.sandbox.paypal.com/web-sdk/v6/core`; no `checkout.razorpay.com`; no `CLIENT_SECRET` in any client payload

## Not in Phase 3

- `POST /api/webhooks/paypal` / delete Razorpay webhook (Phase 4)
- Full `verify-payment-*` rewrites (Phase 5)
- Live credentials / prod deploy / merge to main

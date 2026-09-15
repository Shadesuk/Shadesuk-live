# SHADESUK Phase 3 — Guest checkout shell

**Phase:** 3.8 (storefront checkout / customer / address layer)  
**Status:** Partial — shell only. Payment charge is out of scope.  
**Stacked on:** [PR #15](https://github.com/Shadesuk/Shadesuk-live/pull/15) (`cursor/phase3-cart-bag-f8ed`)

This slice replaces the `/checkout` placeholder with a guest checkout walk: contact → delivery address → review. It stops before payment integration.

## Wired

- `/checkout` — empty bag redirects to `/cart`
- Multi-step UI: **Contact** (continue as guest), **Delivery** (address + shipping expectation), **Review**
- Checkout draft persisted in httpOnly cookie `shadesuk_guest_checkout`, HMAC-bound to the guest cart session. Session id is never in the payload, RSC props, or action JSON
- Order summary from the live cart. Shipping line is **Calculated later**. Minimum 2-week copy. Manual fulfilment note. No carrier API
- Reduced checkout chrome (logo + bag; merchandising nav/footer hidden)
- CSRF/origin checks on checkout Server Actions. Secure cookies in production

## Stubbed / not in this slice

- **Payment charge / SDKs / webhooks** — Review shows “Payment is next.” **Continue to payment** is disabled. Nothing is charged. No Stripe/Razorpay.
- **Paid or pending_payment orders** — not created
- **Address autocomplete vendor** — interface + UI exist; provider is unset. Manual address form is complete. No API keys invented
- **Shipping / carrier rates** — not calculated
- **Account sign-in / Google / cart merge** — Sign in remains a secondary link to `/account` (still unimplemented)
- **Admin dashboard**
- **Order confirmation / tracking**

## Copy

Locked language from `cart_checkout.md` is preserved (Continue as guest, Enter address manually, Secure card payment, checkout session expired, 2-week delivery). Customer-facing payment copy is honest: this screen does not charge a card.

## Verify

```text
npm run verify:checkout
npx tsc --noEmit
npm run lint
```

# SHADESUK Phase 3 — Guest checkout shell

**Phase:** 3.8 (storefront checkout / customer / address layer)  
**Status:** Partial — shell only. Payment charge is out of scope.  
**Stacked on:** [PR #15](https://github.com/Shadesuk/Shadesuk-live/pull/15) (`cursor/phase3-cart-bag-f8ed`)

This slice replaces the `/checkout` placeholder with a guest checkout walk: contact → delivery address → review. It stops before payment integration.

## Wired

- `/checkout` — empty bag redirects to `/cart`
- Multi-step UI: **Contact** (continue as guest), **Delivery** (address + shipping expectation), **Review**
- Checkout draft persisted in httpOnly cookie `shadesuk_guest_checkout`, HMAC-signed with `GUEST_COOKIE_SECRET` (falls back to `SUPABASE_SECRET_KEY`) and bound to the guest cart session. Session id is never the HMAC key, payload, RSC props, or action JSON
- Live cart variant fetch requires `products.status = published` and `product_variants.status = available`
- CSRF/origin checks on checkout Server Actions and cart loaders (`getCartAction` / `loadCart`). Secure cookies in production
- Order summary from the live cart. Shipping line is **Calculated later**. Minimum 2-week copy. Manual fulfilment note. No carrier API
- Reduced checkout chrome (logo + bag; merchandising nav/footer hidden)

## Security (PR #15 Mediums carried into this slice)

- Cookie HMAC uses a server secret, not the session id as the key
- Guest session id is never serialized to the browser
- No payment SDKs/webhooks; Continue to payment remains an honest disabled stub
- Cart `loadCart` / recently-viewed product loader reject cross-origin calls instead of returning cart/product state

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
npm run verify:cart
npx tsc --noEmit
npm run lint
```

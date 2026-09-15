# SHADESUK Phase 3 — Account + auth

**Phase:** 3.7 (account / authentication)  
**Status:** Partial — email/password, password reset, session gate, account home. Google is wired through Supabase Auth; dashboard credentials are still pending.  
**Stacked on:** [PR #16](https://github.com/Shadesuk/Shadesuk-live/pull/16) (`cursor/phase3-guest-checkout-f57d`)

This slice adds `/account` and the locked auth surfaces. Guest checkout stays available without a session. Admin dashboard, payment, and carrier APIs are out of scope.

## Wired

- `/account` — signed-out: **Sign in**; signed-in: overview (`Hello, [First Name]`)
- `/account/register` — first name, last name, email, password
- `/account/forgot-password` — email reset; same success copy whether or not the mailbox exists
- `/account/reset-password` — new password after the recovery session
- `/account/orders` — empty **No orders yet** placeholder (orders not ready)
- `/account/details` — personal details (`Save changes`); email is read-only until verification rules are locked
- `/account/addresses` — saved addresses when `addresses` RLS allows; add/edit uses the shared checkout address form + lookup stub
- Header and mobile **Account** link resolve to `/account` (no 404)
- Next.js 16 **Proxy** (`src/proxy.ts`) refreshes the Supabase session on `/account/**` and `/auth/**` via `getClaims()`
- Account pages call `getUser()` on the server. Nested account routes redirect to `/account` without a session
- CSRF/origin on mutating Server Actions; Secure auth cookies in production
- Guest cart merge on sign-in / register / Google callback using `CART_MERGE_POLICY` (live carts when service-role writes are available). Guest `session_id` is never returned to the browser
- **Continue with Google** calls `signInWithOAuth({ provider: "google" })` and `/auth/callback`

## Google / dashboard still needed

No Google client id or secret is stored in this repo or `.env.example`. The storefront does not invent dashboard secrets.

Until these are set in the **Supabase dashboard**, the Google button stays visible (locked UX) but sign-in fails with **Google sign-in is unavailable.**

1. Google Cloud OAuth client (Web) — client id + secret belong in **Authentication → Providers → Google**, not in Next.js env.
2. Supabase Auth URL configuration:
   - Site URL = `NEXT_PUBLIC_SITE_URL` (production HTTPS origin)
   - Redirect URLs include `{NEXT_PUBLIC_SITE_URL}/auth/callback` plus localhost (`http://localhost:3000/auth/callback`) and each Vercel Preview origin Syed accepts
3. Enable the Google provider. Email/password can ship without this.
4. Optional: custom SMTP for auth mail. Default Supabase mail works for development.
5. Confirm whether email confirmation is required on sign-up. The UI already handles **Check your email** without blocking guest checkout.

## Stubbed / not in this slice

- **Admin dashboard** — not built; `admin_users` is unused
- **Payment SDKs / webhooks / charge**
- **Shipping / carrier APIs**
- **Order history / order detail / tracking** — account orders show the locked empty state
- **Google Cloud credentials** — dashboard-pending as above
- **Address lookup vendor** — same unset provider as checkout; manual entry works
- **Email change verification flow** — email field is displayed, not edited, until that rule is locked

## Security

- Guest checkout (`/checkout`) is outside the session proxy matcher
- Unauthenticated users see sign-in, not another customer’s data
- Password reset always returns **If an account exists for that email, we have sent reset instructions.**
- Profiles and addresses are queried with the cookie-bound user client (RLS), not dumped from the admin client to public handlers
- `createSupabaseAdminClient` is used only for trusted guest-cart merge / live cart writes already established in earlier slices

## Copy

Locked language from `account_order_tracking.md` is preserved (Sign in, Create account, Continue with Google, Forgot password?, Hello, No orders yet, No saved addresses, Shop shades).

## Verify

```bash
npm run verify:account
npm run verify:checkout
npx tsc --noEmit
npm run lint
npm run build
```

# SHADESUK

Ecommerce frontend for SHADESUK.

Approved specification files in this repository are the source of truth.

## Phase 1

Application scaffold only: tokens, typography, layout primitives, accessibility and motion foundations, and a development preview at `/`.

This preview is not the storefront homepage.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase

Copy `.env.example` to `.env.local` and fill in the Supabase values. Variable
names and their exposure rules are documented there; the secret key must never
be given a `NEXT_PUBLIC_` prefix.

Production catalogue behaviour is the published Supabase catalogue. Fixture
products (Frame 01–06) are development/demo only (`DEMO_CATALOGUE`). An empty
published table in production shows empty states; it does not fall back to
demo. See `docs/PHASE3_LIVE_CATALOGUE.md`.

Clients, by execution context:

| Module | Context | Key |
| --- | --- | --- |
| `src/lib/supabase/client.ts` | Client Components | publishable / anon |
| `src/lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers | publishable / anon, with request cookies |
| `src/lib/supabase/admin.ts` | Trusted server work only | secret / service_role |

`server.ts` and `admin.ts` import `server-only`, so importing either from a
Client Component fails the build instead of shipping a secret to the browser.

Verify the connection from a running server:

```bash
curl -s http://localhost:3000/api/health/supabase
```

It returns `200` when the project URL and keys reach Supabase, and `503`
otherwise. No schema is queried, so it stays valid before any migrations exist.

The endpoint is unauthenticated, so in production it answers with `ok` and
`checkedAt` only, and the failing variable names and probe statuses go to the
server log instead. In development the full report comes back in the response.
Either way it never returns key material or an upstream response body, and the
secret key is only ever sent over https or to a loopback address.

### Account / Auth

`/account` is a real route. Signed-out visitors see Sign in / Create account /
Forgot password. Signed-in visitors are gated with `getUser()` on the server.
Session refresh for `/account/**` and `/auth/**` runs in `src/proxy.ts`
(Next.js 16 Proxy; the former middleware file).

Guest checkout at `/checkout` does not require a session.

Guest cart and checkout-draft cookies are HMAC-signed. Production fails closed
if neither `GUEST_COOKIE_SECRET` nor a Supabase secret is set (no local HMAC
fallback). `next dev` may use a development-only fallback.

Google is **Continue with Google** via Supabase Auth. Enable the provider in
the Supabase dashboard. Do not add Google client secrets to this app. Details:
`docs/PHASE3_ACCOUNT_AUTH.md`.

### Migrations (not yet linked)

The CLI is used through `npx` rather than a dependency, so a Vercel build never
has to download its binary:

```bash
npx supabase@2.117.0 --version
npx supabase@2.117.0 login          # or export SUPABASE_ACCESS_TOKEN
npx supabase@2.117.0 link --project-ref <project-ref>
npx supabase@2.117.0 projects list  # confirms the link resolves
```

The project ref is the subdomain of `NEXT_PUBLIC_SUPABASE_URL`
(`https://<project-ref>.supabase.co`). Nothing is linked yet, so no migration
commands should be run.

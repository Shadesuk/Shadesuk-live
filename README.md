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
otherwise. The response reports statuses and variable names only. No schema is
queried, so it stays valid before any migrations exist.

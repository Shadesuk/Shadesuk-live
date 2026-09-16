# SHADESUK Admin V1 — Auth / authorization foundation

**Phase:** After Step 1 audit (PR #25). **Not** AdminShell.  
**Date:** 16 September 2026  
**Authority:** Locked V1 roles are exactly **superadmin** and **admin**.

This document is the owner-facing procedure and architecture record for:

- role model
- RLS split (Settings / archive / delete)
- first Superadmin bootstrap
- `/admin` vs `/account`
- SiteChrome vs future AdminShell

---

## Role model

| Application role | Database `admin_users.role` | `private.is_admin()` | `private.is_superadmin()` |
| --- | --- | --- | --- |
| Admin | `admin` | true | false |
| Superadmin | `superadmin` | true | true |
| Customer / anonymous | no row | false | false |

Postgres enum `admin_role` still contains unused **`operations`** and **`support`** labels because enum values cannot be dropped safely. They are not V1 staff:

- excluded from `private.is_admin()` / `private.is_superadmin()`
- blocked by `admin_users_v1_roles_check`
- `toAdminV1Role()` in the app returns `null`

Do not invent further roles.

---

## First Superadmin bootstrap

There is **no** HTTP endpoint, Server Action, or browser form that grants Superadmin.

Do **not** run this until you have a real email and password for the owner. Do **not** invent credentials. Do **not** commit passwords.

### 1. Create the Auth user (dashboard)

In the Supabase project **Authentication → Users → Add user**:

- Email: the owner mailbox
- Password: a password only the owner knows
- Auto-confirm the email so sign-in works immediately

Copy the user’s UUID.

### 2. Insert the staff row (SQL editor)

Run as the dashboard SQL editor (service role, **no JWT**). Replace the UUID.

```sql
insert into public.admin_users (user_id, role, is_active)
values (
  '00000000-0000-0000-0000-000000000000', -- Auth user UUID
  'superadmin',
  true
);
```

The table default is `admin` (operational). The insert **must** set `role = 'superadmin'`.

Authenticated app sessions cannot perform this insert: RLS has no write policy on `admin_users`, and trigger `admin_users_block_authenticated_writes` rejects writes when `auth.uid()` is present.

### 3. Verify

```sql
select user_id, role, is_active
from public.admin_users
where role = 'superadmin' and is_active;
```

Expect one row. Then sign in at `/admin` with that email and password. You should see **Role: Superadmin**. `/admin/settings` should load the empty Settings stub, not a denial.

### 4. Add an operational Admin later (optional)

Create another Auth user in the dashboard, then:

```sql
insert into public.admin_users (user_id, role, is_active)
values (
  '00000000-0000-0000-0000-000000000000',
  'admin',
  true
);
```

That user can sign in at `/admin` and must be denied at `/admin/settings`.

---

## `/admin` authentication

Same Supabase Auth project as customers. Separate UI.

| Path | Signed out | Customer session | Admin | Superadmin |
| --- | --- | --- | --- | --- |
| `/account` | Customer sign-in | Account | Account (same Auth user, customer UI) | Account |
| `/admin` | Admin sign-in | Denied | Foundation signed-in (no shell) | Foundation signed-in |
| `/admin/settings` | Admin sign-in | Denied | Server deny | Empty stub (no Settings UI) |

Admin sign-in uses `signInWithPassword`, then reads `admin_users` with the **cookie-bound** client. If the password is valid but the user is not V1 staff, the action **signs out** and returns a denial. Role is never taken from the browser.

Customer `next=` cannot point at `/admin`. Admin `next=` cannot point outside `/admin`.

---

## SiteChrome

`src/app/layout.tsx` is document-only (html/body/fonts/skip-link).

`src/app/(storefront)/layout.tsx` wraps customer routes in `SiteChrome`.

`src/app/admin/` is outside that group, so Admin does not inherit header, footer, bag, search, or merchandising nav. Unmatched `/admin/*` renders the Admin not-found view via `admin/[...slug]` (no Shop CTA, no storefront chrome). Unmatched storefront URLs still use root `not-found.tsx` (no chrome). Known storefront routes keep SiteChrome via the group layout. AdminShell is **not** built in this step.

---

## RLS boundaries (V1)

RLS stays enabled. Helpers are `SECURITY DEFINER` and only inspect `auth.uid()`.

| Principal | How it is recognised | Admin data | Products (staff) | Settings / archive / delete |
| --- | --- | --- | --- | --- |
| Anonymous | no JWT | none | public published read only | none |
| Customer | Auth user, no `admin_users` V1 row | none (`is_admin()` false) | public published read only | none |
| Admin (`admin`) | active `admin_users.role = admin` | `is_admin()` true | select/insert/update non-archived; cannot set `archived`; cannot DELETE | denied (`is_superadmin()` false) |
| Superadmin (`superadmin`) | active `admin_users.role = superadmin` | `is_admin()` and `is_superadmin()` | full product write including archive and DELETE | allowed |

`operations` / `support` remain on the Postgres enum only. They fail `admin_users_v1_roles_check` and both helpers.

There is no Settings table yet. `/admin/settings` is denied in the Server Component via `canAccessSettings`. Later Settings writes must use `private.is_superadmin()`.

Variants, images, collections, orders, and customers keep existing `private.is_admin()` policies (both V1 staff roles). Product-level archive/delete is the Superadmin split required before AdminShell.

Authenticated sessions have **no** INSERT/UPDATE/DELETE policy on `admin_users`. Trigger `admin_users_block_authenticated_writes` rejects those writes even if a policy is added later.

## Privilege escalation

- No public bootstrap.
- No `admin_users` INSERT/UPDATE/DELETE policy for `authenticated`.
- Trigger blocks authenticated writes even if a policy is added later by mistake.
- App `canAssignAdminRole()` is always `false`.
- Service-role client is not used on Admin auth routes.
- Roles are stored in `admin_users`, not `user_metadata`.


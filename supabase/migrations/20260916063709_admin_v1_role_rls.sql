begin;

comment on type public.admin_role is
  'V1 staff roles are superadmin and admin. operations and support are unused compatibility values.';

alter table public.admin_users
  drop constraint if exists admin_users_v1_roles_check;

alter table public.admin_users
  add constraint admin_users_v1_roles_check
  check (
    role = 'admin'::public.admin_role
    or role = 'superadmin'::public.admin_role
  );

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and role in (
        'admin'::public.admin_role,
        'superadmin'::public.admin_role
      )
      and is_active
  );
$$;

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and role = 'superadmin'::public.admin_role
      and is_active
  );
$$;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_superadmin() from public, anon;
grant execute on function private.is_superadmin() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Authenticated sessions cannot insert, update, or delete admin_users.
-- JWT-less service-role / dashboard SQL may bootstrap the first Superadmin.
create or replace function private.admin_users_block_authenticated_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    raise exception 'admin_users writes are not permitted from an authenticated session';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists admin_users_block_authenticated_writes on public.admin_users;
create trigger admin_users_block_authenticated_writes
before insert or update or delete on public.admin_users
for each row
execute function private.admin_users_block_authenticated_writes();

drop policy if exists products_admin_manage on public.products;

create policy products_staff_select
on public.products
for select
to authenticated
using (private.is_admin());

create policy products_staff_insert
on public.products
for insert
to authenticated
with check (
  private.is_admin()
  and (
    private.is_superadmin()
    or status in (
      'draft'::public.catalogue_status,
      'published'::public.catalogue_status
    )
  )
);

create policy products_admin_update
on public.products
for update
to authenticated
using (
  private.is_admin()
  and not private.is_superadmin()
  and status is distinct from 'archived'::public.catalogue_status
)
with check (
  private.is_admin()
  and not private.is_superadmin()
  and status is distinct from 'archived'::public.catalogue_status
);

create policy products_superadmin_update
on public.products
for update
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

create policy products_superadmin_delete
on public.products
for delete
to authenticated
using (private.is_superadmin());

commit;

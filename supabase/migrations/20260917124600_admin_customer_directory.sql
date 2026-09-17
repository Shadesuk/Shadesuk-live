-- Operational customer directory for Admin V1.
-- Not a CRM identity table: registered rows are profiles; guest rows are
-- aggregated from guest checkout orders (user_id is null). Guest emails that
-- later match a profile are attributed to that profile so each order appears
-- once. security_invoker keeps underlying RLS; is_admin() hides the directory
-- from customer JWTs.

create or replace view public.admin_customer_directory
with (security_invoker = true) as
select
  directory.id,
  directory.account_type,
  directory.user_id,
  directory.email,
  directory.first_name,
  directory.last_name,
  directory.created_at,
  directory.order_count,
  directory.total_spent_minor,
  directory.last_order_at
from (
  select
    p.id::text as id,
    'registered'::text as account_type,
    p.id as user_id,
    lower(btrim(p.email)) as email,
    coalesce(nullif(btrim(p.first_name), ''), '') as first_name,
    coalesce(nullif(btrim(p.last_name), ''), '') as last_name,
    p.created_at,
    coalesce(stats.order_count, 0) as order_count,
    coalesce(stats.total_spent_minor, 0) as total_spent_minor,
    stats.last_order_at
  from public.profiles p
  left join lateral (
    select
      count(*)::integer as order_count,
      coalesce(
        sum(o.total_minor) filter (where o.payment_status = 'captured'),
        0
      )::integer as total_spent_minor,
      max(o.created_at) as last_order_at
    from public.orders o
    where o.user_id = p.id
      or (
        o.user_id is null
        and lower(btrim(o.customer_email)) = lower(btrim(p.email))
      )
  ) stats on true

  union all

  select
    ('guest:' || guest.email) as id,
    'guest'::text as account_type,
    null::uuid as user_id,
    guest.email,
    guest.first_name,
    guest.last_name,
    guest.first_seen as created_at,
    guest.order_count,
    guest.total_spent_minor,
    guest.last_order_at
  from (
    select
      lower(btrim(o.customer_email)) as email,
      count(*)::integer as order_count,
      coalesce(
        sum(o.total_minor) filter (where o.payment_status = 'captured'),
        0
      )::integer as total_spent_minor,
      max(o.created_at) as last_order_at,
      min(o.created_at) as first_seen,
      coalesce(
        nullif(btrim((array_agg(o.customer_first_name order by o.created_at desc))[1]), ''),
        ''
      ) as first_name,
      coalesce(
        nullif(btrim((array_agg(o.customer_last_name order by o.created_at desc))[1]), ''),
        ''
      ) as last_name
    from public.orders o
    where o.user_id is null
      and not exists (
        select 1
        from public.profiles p
        where lower(btrim(p.email)) = lower(btrim(o.customer_email))
      )
    group by lower(btrim(o.customer_email))
  ) guest
) directory
where private.is_admin();

comment on view public.admin_customer_directory is
  'Admin operational directory. Registered = profiles; guest = order-derived emails.';

revoke all on table public.admin_customer_directory from public, anon, authenticated;
grant select on table public.admin_customer_directory to authenticated;

create index if not exists orders_guest_email_lower_idx
  on public.orders (lower(btrim(customer_email)))
  where user_id is null;

create index if not exists profiles_email_lower_idx
  on public.profiles (lower(btrim(email)));

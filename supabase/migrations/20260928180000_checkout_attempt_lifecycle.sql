-- Provisional checkout is not a confirmed order.
-- Does not update or delete existing order rows.

alter type public.order_status add value if not exists 'checkout';

comment on column public.orders.status is
  'Fulfilment status after a committed purchase. checkout is an unpaid attempt, not a placed order. Existing rows are left unchanged.';

comment on column public.orders.payment_status is
  'created, authorized, failed, and cancelled are not completed purchases. captured, refunded, and partially_refunded are committed purchases.';

-- Order counts follow committed purchases. Abandoned checkouts stay in orders
-- but do not increment the directory. No row is deleted.
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
      count(*) filter (
        where o.payment_status in ('captured', 'refunded', 'partially_refunded')
      )::integer as order_count,
      coalesce(
        sum(o.total_minor) filter (where o.payment_status = 'captured'),
        0
      )::integer as total_spent_minor,
      max(o.created_at) filter (
        where o.payment_status in ('captured', 'refunded', 'partially_refunded')
      ) as last_order_at
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
      and o.payment_status in ('captured', 'refunded', 'partially_refunded')
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
  'Admin operational directory. Order counts are committed purchases only. Abandoned checkouts are not orders.';

revoke all on table public.admin_customer_directory from public, anon, authenticated;
grant select on table public.admin_customer_directory to authenticated;

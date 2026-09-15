begin;

-- Cover the remaining foreign keys used by referential checks and joins.
create index cart_items_product_variant_id_idx
  on public.cart_items (product_variant_id);
create index order_events_actor_user_id_idx
  on public.order_events (actor_user_id);
create index order_items_product_id_idx
  on public.order_items (product_id);
create index order_items_variant_product_idx
  on public.order_items (product_variant_id, product_id);
create index product_images_variant_product_idx
  on public.product_images (variant_id, product_id);
create index tracking_events_created_by_idx
  on public.tracking_events (created_by);

-- Evaluate the authenticated identity once per statement rather than once
-- per candidate row. Policy ownership semantics remain unchanged.
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
      and role = 'admin'::public.admin_role
      and is_active
  );
$$;

alter policy profiles_customer_select_own
on public.profiles
using (id = (select auth.uid()));

alter policy profiles_customer_insert_own
on public.profiles
with check (
  id = (select auth.uid())
  and email = ((select auth.jwt()) ->> 'email')
);

alter policy profiles_customer_update_own
on public.profiles
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

alter policy carts_customer_select_own
on public.carts
using (user_id = (select auth.uid()));

alter policy carts_customer_insert_own
on public.carts
with check (
  user_id = (select auth.uid())
  and session_id is null
);

alter policy carts_customer_update_own
on public.carts
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and session_id is null
);

alter policy carts_customer_delete_own
on public.carts
using (user_id = (select auth.uid()));

alter policy cart_items_customer_select_own
on public.cart_items
using (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
);

alter policy cart_items_customer_insert_own
on public.cart_items
with check (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
);

alter policy cart_items_customer_update_own
on public.cart_items
using (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
);

alter policy cart_items_customer_delete_own
on public.cart_items
using (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
);

alter policy addresses_customer_select_own
on public.addresses
using (user_id = (select auth.uid()));

alter policy addresses_customer_insert_own
on public.addresses
with check (user_id = (select auth.uid()));

alter policy addresses_customer_update_own
on public.addresses
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter policy addresses_customer_delete_own
on public.addresses
using (user_id = (select auth.uid()));

alter policy orders_customer_select_own
on public.orders
using (user_id = (select auth.uid()));

alter policy order_items_customer_select_own
on public.order_items
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
  )
);

alter policy shipments_customer_select_own
on public.shipments
using (
  exists (
    select 1
    from public.orders
    where orders.id = shipments.order_id
      and orders.user_id = (select auth.uid())
  )
);

alter policy tracking_events_customer_select_own
on public.tracking_events
using (
  exists (
    select 1
    from public.shipments
    join public.orders on orders.id = shipments.order_id
    where shipments.id = tracking_events.shipment_id
      and orders.user_id = (select auth.uid())
  )
);

alter policy order_events_customer_select_visible_own
on public.order_events
using (
  customer_visible
  and exists (
    select 1
    from public.orders
    where orders.id = order_events.order_id
      and orders.user_id = (select auth.uid())
  )
);

alter policy tracking_events_admin_insert
on public.tracking_events
with check (
  private.is_admin()
  and created_by = (select auth.uid())
);

alter policy order_events_admin_insert
on public.order_events
with check (
  private.is_admin()
  and actor_user_id = (select auth.uid())
);

commit;

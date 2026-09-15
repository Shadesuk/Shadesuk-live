begin;

-- Keep privileged authorization helpers outside the exposed public schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.admin_role as enum (
  'admin',
  'operations',
  'support'
);

create type public.catalogue_status as enum (
  'draft',
  'published',
  'archived'
);

create type public.variant_status as enum (
  'draft',
  'available',
  'unavailable',
  'archived'
);

create type public.product_image_type as enum (
  'primary',
  'secondary',
  'detail',
  'side',
  'lifestyle'
);

create type public.cart_status as enum (
  'active',
  'converted',
  'abandoned',
  'expired'
);

create type public.order_status as enum (
  'placed',
  'processing',
  'dispatched',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'tracking_unavailable'
);

create type public.payment_status as enum (
  'created',
  'authorized',
  'captured',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded'
);

create type public.shipment_status as enum (
  'pending',
  'dispatched',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'tracking_unavailable'
);

create type public.email_status as enum (
  'pending',
  'sent',
  'failed'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_not_blank check (btrim(email) <> '')
);

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.admin_role not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand text,
  description text,
  details jsonb,
  materials text,
  whats_included text,
  shape text,
  gender text,
  fit text,
  disclosure text not null default 'High-quality 1:1 Superclone',
  status public.catalogue_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_format check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_disclosure_not_blank check (btrim(disclosure) <> ''),
  constraint products_details_object check (
    details is null or jsonb_typeof(details) = 'object'
  )
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  colour_name text not null,
  size_name text,
  price_minor integer not null,
  compare_at_price_minor integer,
  currency text not null default 'GBP',
  lens_width_mm integer,
  bridge_width_mm integer,
  temple_length_mm integer,
  stock_quantity integer not null default 0,
  status public.variant_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_id_product_id_key unique (id, product_id),
  constraint product_variants_options_key unique nulls not distinct (
    product_id,
    colour_name,
    size_name
  ),
  constraint product_variants_sku_not_blank check (btrim(sku) <> ''),
  constraint product_variants_colour_not_blank check (btrim(colour_name) <> ''),
  constraint product_variants_size_not_blank check (
    size_name is null or btrim(size_name) <> ''
  ),
  constraint product_variants_price_nonnegative check (price_minor >= 0),
  constraint product_variants_compare_price_valid check (
    compare_at_price_minor is null
    or compare_at_price_minor >= price_minor
  ),
  constraint product_variants_currency_gbp check (currency = 'GBP'),
  constraint product_variants_lens_width_positive check (
    lens_width_mm is null or lens_width_mm > 0
  ),
  constraint product_variants_bridge_width_positive check (
    bridge_width_mm is null or bridge_width_mm > 0
  ),
  constraint product_variants_temple_length_positive check (
    temple_length_mm is null or temple_length_mm > 0
  ),
  constraint product_variants_stock_nonnegative check (stock_quantity >= 0)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid,
  storage_path text not null,
  alt_text text not null,
  sort_order integer not null default 0,
  image_type public.product_image_type not null,
  is_primary boolean generated always as (
    image_type = 'primary'::public.product_image_type
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_variant_product_fkey
    foreign key (variant_id, product_id)
    references public.product_variants (id, product_id)
    on delete restrict,
  constraint product_images_storage_path_not_blank check (
    btrim(storage_path) <> ''
  ),
  constraint product_images_sort_order_nonnegative check (sort_order >= 0)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  image_path text,
  status public.catalogue_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_slug_format check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint collections_name_not_blank check (btrim(name) <> ''),
  constraint collections_image_path_not_blank check (
    image_path is null or btrim(image_path) <> ''
  ),
  constraint collections_sort_order_nonnegative check (sort_order >= 0)
);

create table public.product_collections (
  product_id uuid not null references public.products (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, collection_id)
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  session_id text,
  status public.cart_status not null default 'active',
  currency text not null default 'GBP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_exactly_one_owner check (
    (user_id is not null and session_id is null)
    or (user_id is null and session_id is not null)
  ),
  constraint carts_session_id_not_blank check (
    session_id is null or btrim(session_id) <> ''
  ),
  constraint carts_currency_gbp check (currency = 'GBP')
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity integer not null,
  unit_price_minor integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_cart_variant_key unique (cart_id, product_variant_id),
  constraint cart_items_quantity_positive check (quantity > 0),
  constraint cart_items_unit_price_nonnegative check (unit_price_minor >= 0)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  first_name text not null,
  last_name text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  county text,
  postcode text not null,
  country text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_first_name_not_blank check (btrim(first_name) <> ''),
  constraint addresses_last_name_not_blank check (btrim(last_name) <> ''),
  constraint addresses_line_1_not_blank check (btrim(address_line_1) <> ''),
  constraint addresses_city_not_blank check (btrim(city) <> ''),
  constraint addresses_postcode_not_blank check (btrim(postcode) <> ''),
  constraint addresses_country_not_blank check (btrim(country) <> '')
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  customer_email text not null,
  customer_first_name text not null,
  customer_last_name text not null,
  status public.order_status not null default 'placed',
  payment_status public.payment_status not null default 'created',
  currency text not null default 'GBP',
  subtotal_minor integer not null,
  shipping_minor integer not null,
  total_minor integer not null,
  delivery_address jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_reference_not_blank check (btrim(order_reference) <> ''),
  constraint orders_customer_email_not_blank check (btrim(customer_email) <> ''),
  constraint orders_customer_first_name_not_blank check (
    btrim(customer_first_name) <> ''
  ),
  constraint orders_customer_last_name_not_blank check (
    btrim(customer_last_name) <> ''
  ),
  constraint orders_currency_gbp check (currency = 'GBP'),
  constraint orders_amounts_nonnegative check (
    subtotal_minor >= 0
    and shipping_minor >= 0
    and total_minor >= 0
  ),
  constraint orders_total_matches_components check (
    total_minor = subtotal_minor + shipping_minor
  ),
  constraint orders_delivery_address_object check (
    jsonb_typeof(delivery_address) = 'object'
    and delivery_address <> '{}'::jsonb
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  product_variant_id uuid,
  sku text not null,
  product_name text not null,
  colour_name text not null,
  variant_name text,
  quantity integer not null,
  unit_price_minor integer not null,
  line_total_minor integer not null,
  product_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint order_items_variant_product_fkey
    foreign key (product_variant_id, product_id)
    references public.product_variants (id, product_id)
    on delete restrict,
  constraint order_items_sku_not_blank check (btrim(sku) <> ''),
  constraint order_items_product_name_not_blank check (
    btrim(product_name) <> ''
  ),
  constraint order_items_colour_not_blank check (btrim(colour_name) <> ''),
  constraint order_items_variant_name_not_blank check (
    variant_name is null or btrim(variant_name) <> ''
  ),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_nonnegative check (unit_price_minor >= 0),
  constraint order_items_line_total_nonnegative check (line_total_minor >= 0),
  constraint order_items_line_total_matches check (
    line_total_minor = unit_price_minor * quantity
  ),
  constraint order_items_product_snapshot_object check (
    product_snapshot is null or jsonb_typeof(product_snapshot) = 'object'
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null,
  provider_order_id text unique,
  provider_payment_id text unique,
  amount_minor integer not null,
  currency text not null,
  status public.payment_status not null default 'created',
  failure_reason text,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider_not_blank check (btrim(provider) <> ''),
  constraint payments_provider_order_id_not_blank check (
    provider_order_id is null or btrim(provider_order_id) <> ''
  ),
  constraint payments_provider_payment_id_not_blank check (
    provider_payment_id is null or btrim(provider_payment_id) <> ''
  ),
  constraint payments_amount_nonnegative check (amount_minor >= 0),
  constraint payments_currency_gbp check (currency = 'GBP')
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_webhook_events_provider_not_blank check (
    btrim(provider) <> ''
  ),
  constraint payment_webhook_events_provider_event_id_not_blank check (
    btrim(provider_event_id) <> ''
  ),
  constraint payment_webhook_events_event_type_not_blank check (
    btrim(event_type) <> ''
  ),
  constraint payment_webhook_events_payload_object check (
    jsonb_typeof(payload) = 'object'
  ),
  constraint payment_webhook_events_processed_at_consistent check (
    (processed and processed_at is not null)
    or (not processed and processed_at is null)
  )
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  carrier_name text,
  tracking_number text,
  tracking_url text,
  status public.shipment_status not null default 'pending',
  shipped_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipments_carrier_name_not_blank check (
    carrier_name is null or btrim(carrier_name) <> ''
  ),
  constraint shipments_tracking_number_not_blank check (
    tracking_number is null or btrim(tracking_number) <> ''
  ),
  constraint shipments_tracking_url_not_blank check (
    tracking_url is null or btrim(tracking_url) <> ''
  ),
  constraint shipments_delivery_after_shipping check (
    delivered_at is null
    or shipped_at is null
    or delivered_at >= shipped_at
  )
);

comment on column public.shipments.notes is
  'Internal fulfilment notes. This column is not selectable by client roles.';

create table public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete restrict,
  status public.shipment_status not null,
  description text,
  occurred_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  event_type text not null,
  old_status public.order_status,
  new_status public.order_status,
  actor_user_id uuid references auth.users (id) on delete set null,
  metadata jsonb,
  customer_visible boolean not null default false,
  created_at timestamptz not null default now(),
  constraint order_events_event_type_not_blank check (btrim(event_type) <> ''),
  constraint order_events_metadata_object check (
    metadata is null or jsonb_typeof(metadata) = 'object'
  )
);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete set null,
  recipient_email text not null,
  email_type text not null,
  provider text not null,
  provider_message_id text,
  idempotency_key text not null unique,
  status public.email_status not null default 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_events_recipient_not_blank check (
    btrim(recipient_email) <> ''
  ),
  constraint email_events_type_not_blank check (btrim(email_type) <> ''),
  constraint email_events_provider_not_blank check (btrim(provider) <> ''),
  constraint email_events_provider_message_id_not_blank check (
    provider_message_id is null or btrim(provider_message_id) <> ''
  ),
  constraint email_events_idempotency_key_not_blank check (
    btrim(idempotency_key) <> ''
  )
);

-- Lookup and relationship indexes. Unique constraints already provide
-- indexes for slugs, SKUs, order references, and provider identifiers.
create index products_status_idx on public.products (status);

create index product_variants_product_id_idx
  on public.product_variants (product_id);
create index product_variants_status_idx
  on public.product_variants (status);

create index product_images_product_id_sort_order_idx
  on public.product_images (product_id, sort_order);
create index product_images_variant_id_idx
  on public.product_images (variant_id)
  where variant_id is not null;
create unique index product_images_product_primary_key
  on public.product_images (product_id)
  where is_primary and variant_id is null;
create unique index product_images_variant_primary_key
  on public.product_images (variant_id)
  where is_primary and variant_id is not null;

create index collections_status_sort_order_idx
  on public.collections (status, sort_order);
create index product_collections_collection_id_idx
  on public.product_collections (collection_id);

create unique index carts_one_active_user_cart_key
  on public.carts (user_id)
  where status = 'active'::public.cart_status and user_id is not null;
create unique index carts_one_active_guest_cart_key
  on public.carts (session_id)
  where status = 'active'::public.cart_status and session_id is not null;
create index carts_user_id_idx
  on public.carts (user_id)
  where user_id is not null;

create index cart_items_cart_id_idx on public.cart_items (cart_id);

create index addresses_user_id_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user_key
  on public.addresses (user_id)
  where is_default;

create index orders_user_id_idx
  on public.orders (user_id)
  where user_id is not null;
create index orders_customer_email_idx on public.orders (customer_email);
create index orders_status_idx on public.orders (status);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_at_idx on public.orders (created_at desc);

create index order_items_order_id_idx on public.order_items (order_id);

create index payments_order_id_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status);

create index payment_webhook_events_processed_idx
  on public.payment_webhook_events (processed, created_at);

create index shipments_tracking_number_idx
  on public.shipments (tracking_number)
  where tracking_number is not null;

create index tracking_events_shipment_id_idx
  on public.tracking_events (shipment_id);
create index tracking_events_occurred_at_idx
  on public.tracking_events (occurred_at desc);

create index order_events_order_id_idx on public.order_events (order_id);
create index order_events_created_at_idx
  on public.order_events (created_at desc);

create index email_events_order_id_idx
  on public.email_events (order_id)
  where order_id is not null;
create index email_events_status_idx on public.email_events (status);
create unique index email_events_provider_message_key
  on public.email_events (provider, provider_message_id)
  where provider_message_id is not null;

-- The function owner bypasses admin_users RLS. The function is not exposed
-- through public and uses an empty search path to prevent object shadowing.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role = 'admin'::public.admin_role
      and is_active
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Remove broad default table privileges before assigning least privilege.
revoke all on table
  public.profiles,
  public.admin_users,
  public.products,
  public.product_variants,
  public.product_images,
  public.collections,
  public.product_collections,
  public.carts,
  public.cart_items,
  public.addresses,
  public.orders,
  public.order_items,
  public.payments,
  public.payment_webhook_events,
  public.shipments,
  public.tracking_events,
  public.order_events,
  public.email_events
from anon, authenticated;

grant select on table
  public.products,
  public.product_variants,
  public.product_images,
  public.collections,
  public.product_collections
to anon;

grant select, insert, update, delete on table
  public.products,
  public.product_variants,
  public.product_images,
  public.collections,
  public.product_collections
to authenticated;

grant select, insert on table public.profiles to authenticated;
grant update (first_name, last_name, phone, updated_at)
  on table public.profiles
  to authenticated;
grant select on table public.admin_users to authenticated;
grant select, insert, update, delete on table
  public.carts,
  public.cart_items,
  public.addresses
to authenticated;
grant select on table public.orders to authenticated;
grant update (status, updated_at) on table public.orders to authenticated;
grant select, insert on table public.order_items to authenticated;
grant select on table
  public.payments,
  public.payment_webhook_events
to authenticated;
grant select (
  id,
  order_id,
  carrier_name,
  tracking_number,
  tracking_url,
  status,
  shipped_at,
  delivered_at,
  created_at,
  updated_at
) on table public.shipments to authenticated;
grant insert, update on table public.shipments to authenticated;
grant select, insert on table public.tracking_events to authenticated;
grant select, insert on table public.order_events to authenticated;
grant select, insert, update on table public.email_events to authenticated;

grant all on table
  public.profiles,
  public.admin_users,
  public.products,
  public.product_variants,
  public.product_images,
  public.collections,
  public.product_collections,
  public.carts,
  public.cart_items,
  public.addresses,
  public.orders,
  public.order_items,
  public.payments,
  public.payment_webhook_events,
  public.shipments,
  public.tracking_events,
  public.order_events,
  public.email_events
to service_role;

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.collections enable row level security;
alter table public.product_collections enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.shipments enable row level security;
alter table public.tracking_events enable row level security;
alter table public.order_events enable row level security;
alter table public.email_events enable row level security;

-- Public catalogue: published rows are readable and never publicly writable.
create policy products_public_read_published
on public.products
for select
to anon, authenticated
using (status = 'published'::public.catalogue_status);

create policy product_variants_public_read_available
on public.product_variants
for select
to anon, authenticated
using (
  status = 'available'::public.variant_status
  and exists (
    select 1
    from public.products
    where products.id = product_variants.product_id
      and products.status = 'published'::public.catalogue_status
  )
);

create policy product_images_public_read_published
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_images.product_id
      and products.status = 'published'::public.catalogue_status
  )
  and (
    variant_id is null
    or exists (
      select 1
      from public.product_variants
      where product_variants.id = product_images.variant_id
        and product_variants.status = 'available'::public.variant_status
    )
  )
);

create policy collections_public_read_published
on public.collections
for select
to anon, authenticated
using (status = 'published'::public.catalogue_status);

create policy product_collections_public_read_published
on public.product_collections
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_collections.product_id
      and products.status = 'published'::public.catalogue_status
  )
  and exists (
    select 1
    from public.collections
    where collections.id = product_collections.collection_id
      and collections.status = 'published'::public.catalogue_status
  )
);

-- Customer identity is always derived from auth.uid().
create policy profiles_customer_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_customer_insert_own
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and email = (auth.jwt() ->> 'email')
);

create policy profiles_customer_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy carts_customer_select_own
on public.carts
for select
to authenticated
using (user_id = auth.uid());

create policy carts_customer_insert_own
on public.carts
for insert
to authenticated
with check (user_id = auth.uid() and session_id is null);

create policy carts_customer_update_own
on public.carts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and session_id is null);

create policy carts_customer_delete_own
on public.carts
for delete
to authenticated
using (user_id = auth.uid());

create policy cart_items_customer_select_own
on public.cart_items
for select
to authenticated
using (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  )
);

create policy cart_items_customer_insert_own
on public.cart_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  )
);

create policy cart_items_customer_update_own
on public.cart_items
for update
to authenticated
using (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  )
);

create policy cart_items_customer_delete_own
on public.cart_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  )
);

create policy addresses_customer_select_own
on public.addresses
for select
to authenticated
using (user_id = auth.uid());

create policy addresses_customer_insert_own
on public.addresses
for insert
to authenticated
with check (user_id = auth.uid());

create policy addresses_customer_update_own
on public.addresses
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy addresses_customer_delete_own
on public.addresses
for delete
to authenticated
using (user_id = auth.uid());

create policy orders_customer_select_own
on public.orders
for select
to authenticated
using (user_id = auth.uid());

create policy order_items_customer_select_own
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

create policy shipments_customer_select_own
on public.shipments
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = shipments.order_id
      and orders.user_id = auth.uid()
  )
);

create policy tracking_events_customer_select_own
on public.tracking_events
for select
to authenticated
using (
  exists (
    select 1
    from public.shipments
    join public.orders on orders.id = shipments.order_id
    where shipments.id = tracking_events.shipment_id
      and orders.user_id = auth.uid()
  )
);

create policy order_events_customer_select_visible_own
on public.order_events
for select
to authenticated
using (
  customer_visible
  and exists (
    select 1
    from public.orders
    where orders.id = order_events.order_id
      and orders.user_id = auth.uid()
  )
);

-- Active admin access is checked through a non-recursive security-definer
-- helper. The V1 policy authorizes only the admin role.
create policy admin_users_admin_read
on public.admin_users
for select
to authenticated
using (private.is_admin());

create policy profiles_admin_read
on public.profiles
for select
to authenticated
using (private.is_admin());

create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy products_admin_manage
on public.products
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy product_variants_admin_manage
on public.product_variants
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy product_images_admin_manage
on public.product_images
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy collections_admin_manage
on public.collections
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy product_collections_admin_manage
on public.product_collections
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy carts_admin_manage
on public.carts
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy cart_items_admin_manage
on public.cart_items
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy addresses_admin_read
on public.addresses
for select
to authenticated
using (private.is_admin());

create policy addresses_admin_update
on public.addresses
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy orders_admin_read
on public.orders
for select
to authenticated
using (private.is_admin());

create policy orders_admin_update
on public.orders
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy order_items_admin_read
on public.order_items
for select
to authenticated
using (private.is_admin());

create policy order_items_admin_insert
on public.order_items
for insert
to authenticated
with check (private.is_admin());

create policy payments_admin_read
on public.payments
for select
to authenticated
using (private.is_admin());

create policy payment_webhook_events_admin_read
on public.payment_webhook_events
for select
to authenticated
using (private.is_admin());

create policy shipments_admin_read
on public.shipments
for select
to authenticated
using (private.is_admin());

create policy shipments_admin_insert
on public.shipments
for insert
to authenticated
with check (private.is_admin());

create policy shipments_admin_update
on public.shipments
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy tracking_events_admin_read
on public.tracking_events
for select
to authenticated
using (private.is_admin());

create policy tracking_events_admin_insert
on public.tracking_events
for insert
to authenticated
with check (
  private.is_admin()
  and created_by = auth.uid()
);

create policy order_events_admin_read
on public.order_events
for select
to authenticated
using (private.is_admin());

create policy order_events_admin_insert
on public.order_events
for insert
to authenticated
with check (
  private.is_admin()
  and actor_user_id = auth.uid()
);

create policy email_events_admin_read
on public.email_events
for select
to authenticated
using (private.is_admin());

create policy email_events_admin_insert
on public.email_events
for insert
to authenticated
with check (private.is_admin());

create policy email_events_admin_update
on public.email_events
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

commit;

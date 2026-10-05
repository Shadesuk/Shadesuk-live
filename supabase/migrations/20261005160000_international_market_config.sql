begin;

-- Phase 1 international checkout configuration.
-- Additive tables only. Does not alter orders, payments, carts, or
-- product_variants. GBP checks on those tables stay in place.
-- Catalogue prices stay GBP. Market charge currencies are GBP, EUR, USD, and INR.
-- A later phase writes the charge currency onto the order. This migration does not.
-- V1 tax and discount are zero. The order total remains subtotal plus shipping.
-- No total equation is added here, so a later phase can add tax and discount
-- columns without fighting a new check from this migration.
-- No Frankfurter fetch, no Geoapify, no checkout wiring, no payment SDK.
-- Checkout stays Contact, Delivery, Review. This migration adds no screen.
-- International shipping zones exist so a country can resolve to a zone.
-- Only the UK method is priced (465 pence, estimate 2+ weeks). Other zones have no rate rows.

create table public.currencies (
  code text primary key,
  name text not null,
  minor_unit_exponent smallint not null,
  is_catalogue_base boolean not null default false,
  created_at timestamptz not null default now(),
  constraint currencies_code_iso check (code ~ '^[A-Z]{3}$'),
  constraint currencies_name_not_blank check (btrim(name) <> ''),
  constraint currencies_exponent_range check (
    minor_unit_exponent >= 0
    and minor_unit_exponent <= 4
  )
);

create unique index currencies_one_catalogue_base_idx
  on public.currencies (is_catalogue_base)
  where is_catalogue_base;

comment on table public.currencies is
  'ISO currencies the storefront may display or charge. GBP remains the catalogue base. This table does not relax product, cart, order, or payment GBP checks.';

create table public.markets (
  id text primary key,
  name text not null,
  currency_code text not null references public.currencies (code),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint markets_id_format check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint markets_name_not_blank check (btrim(name) <> ''),
  constraint markets_id_currency_key unique (id, currency_code)
);

comment on table public.markets is
  'V1 destination markets. One currency per market. Checkout does not read this table yet.';

create table public.market_payment_methods (
  market_id text not null,
  currency_code text not null,
  payment_provider text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (market_id),
  constraint market_payment_methods_market_currency_fkey
    foreign key (market_id, currency_code)
    references public.markets (id, currency_code),
  constraint market_payment_provider_known check (
    payment_provider in ('paypal', 'razorpay')
  ),
  -- India + INR is Razorpay. Every other mapped market stays PayPal.
  -- This is configuration only. No Razorpay adapter is installed here.
  constraint market_payment_razorpay_is_india_inr check (
    (payment_provider = 'razorpay')
    = (market_id = 'india' and currency_code = 'INR')
  )
);

comment on table public.market_payment_methods is
  'Payment provider for a market currency. India/INR maps to razorpay. Other V1 markets map to paypal. Phase 6 reads this. Phase 1 does not call a provider.';

create table public.countries (
  code text primary key,
  name text not null,
  market_id text references public.markets (id),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countries_code_iso check (code ~ '^[A-Z]{2}$'),
  constraint countries_name_not_blank check (btrim(name) <> ''),
  constraint countries_code_market_key unique (code, market_id)
);

comment on table public.countries is
  'ISO countries assigned to a market. A null market_id is unsupported. Only named V1 countries are seeded.';

create table public.shipping_zones (
  id text primary key,
  market_id text not null references public.markets (id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_zones_id_format check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint shipping_zones_name_not_blank check (btrim(name) <> ''),
  constraint shipping_zones_id_market_key unique (id, market_id)
);

comment on table public.shipping_zones is
  'Destination shipping zones. A zone may exist before any method or price is configured.';

create table public.shipping_zone_countries (
  country_code text primary key,
  zone_id text not null,
  market_id text not null,
  created_at timestamptz not null default now(),
  constraint shipping_zone_countries_country_market_fkey
    foreign key (country_code, market_id)
    references public.countries (code, market_id),
  constraint shipping_zone_countries_zone_market_fkey
    foreign key (zone_id, market_id)
    references public.shipping_zones (id, market_id)
);

create index shipping_zone_countries_zone_id_idx
  on public.shipping_zone_countries (zone_id);

comment on table public.shipping_zone_countries is
  'One zone per country. Country and zone must belong to the same market.';

create table public.shipping_methods (
  id text primary key,
  zone_id text not null references public.shipping_zones (id),
  code text not null,
  label text not null,
  estimated_delivery text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_methods_id_format check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint shipping_methods_code_format check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint shipping_methods_label_not_blank check (btrim(label) <> ''),
  constraint shipping_methods_estimate_not_blank check (btrim(estimated_delivery) <> ''),
  constraint shipping_methods_zone_code_key unique (zone_id, code)
);

create index shipping_methods_zone_id_idx
  on public.shipping_methods (zone_id);

comment on table public.shipping_methods is
  'Shipping methods offered inside a zone. UK Standard Delivery is the only seeded method.';

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  method_id text not null references public.shipping_methods (id),
  currency_code text not null references public.currencies (code),
  amount_minor integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_rates_amount_nonnegative check (amount_minor >= 0),
  constraint shipping_rates_method_currency_key unique (method_id, currency_code)
);

create index shipping_rates_method_id_idx
  on public.shipping_rates (method_id);

comment on table public.shipping_rates is
  'Integer minor-unit shipping prices. The only seed is UK Standard Delivery at 465 GBP pence. No international price is invented.';

comment on column public.shipping_rates.amount_minor is
  'Minor units of currency_code. 465 is £4.65 for the UK method.';

create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null references public.currencies (code),
  quote_currency text not null references public.currencies (code),
  rate numeric(20, 10) not null,
  source text not null,
  effective_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  status text not null default 'active',
  version bigint generated always as identity,
  created_at timestamptz not null default now(),
  constraint fx_rates_pair_distinct check (base_currency <> quote_currency),
  constraint fx_rates_rate_positive check (
    rate > 0
    and rate <> 'NaN'::numeric
  ),
  constraint fx_rates_base_gbp check (base_currency = 'GBP'),
  constraint fx_rates_source_not_blank check (btrim(source) <> ''),
  constraint fx_rates_status_known check (status in ('active', 'rejected'))
);

create index fx_rates_active_pair_version_idx
  on public.fx_rates (base_currency, quote_currency, version desc)
  where status = 'active';

comment on table public.fx_rates is
  'Append-only FX observations. Insert a new row for a new rate. Never update or delete a row a quote or order may reference. No rates are seeded. Checkout does not read this table yet.';

comment on column public.fx_rates.id is
  'Stable key for a later checkout quote to store. The quote phase attaches this id. This migration does not add that column to orders or change the checkout total.';

comment on column public.fx_rates.rate is
  'Positive numeric rate. Zero, negative, and NaN are rejected. Base currency is GBP, the catalogue currency.';

comment on column public.fx_rates.version is
  'Monotonic identity stored with fx_rates.id so a quote can name the exact observation. History is not overwritten.';

create or replace function private.fx_rates_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'fx_rates is append-only';
end;
$$;

create trigger fx_rates_no_update
before update or delete on public.fx_rates
for each row
execute function private.fx_rates_append_only();

create trigger fx_rates_no_truncate
before truncate on public.fx_rates
for each statement
execute function private.fx_rates_append_only();

revoke all on function private.fx_rates_append_only() from public, anon, authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

create trigger markets_touch_updated_at
before update on public.markets
for each row
execute function private.touch_updated_at();

create trigger market_payment_methods_touch_updated_at
before update on public.market_payment_methods
for each row
execute function private.touch_updated_at();

create trigger countries_touch_updated_at
before update on public.countries
for each row
execute function private.touch_updated_at();

create trigger shipping_zones_touch_updated_at
before update on public.shipping_zones
for each row
execute function private.touch_updated_at();

create trigger shipping_methods_touch_updated_at
before update on public.shipping_methods
for each row
execute function private.touch_updated_at();

create trigger shipping_rates_touch_updated_at
before update on public.shipping_rates
for each row
execute function private.touch_updated_at();

insert into public.currencies (code, name, minor_unit_exponent, is_catalogue_base)
values
  ('GBP', 'Pound sterling', 2, true),
  ('EUR', 'Euro', 2, false),
  ('USD', 'US dollar', 2, false),
  ('INR', 'Indian rupee', 2, false);

insert into public.markets (id, name, currency_code, is_active)
values
  ('uk', 'United Kingdom', 'GBP', true),
  ('europe', 'Europe', 'EUR', true),
  ('usa', 'United States', 'USD', true),
  ('gcc', 'GCC', 'USD', true),
  ('india', 'India', 'INR', true);

insert into public.market_payment_methods (market_id, currency_code, payment_provider)
values
  ('uk', 'GBP', 'paypal'),
  ('europe', 'EUR', 'paypal'),
  ('usa', 'USD', 'paypal'),
  ('gcc', 'USD', 'paypal'),
  ('india', 'INR', 'razorpay');

insert into public.countries (code, name, market_id, is_active)
values
  ('GB', 'United Kingdom', 'uk', true),
  ('DE', 'Germany', 'europe', true),
  ('FR', 'France', 'europe', true),
  ('US', 'United States', 'usa', true),
  ('AE', 'United Arab Emirates', 'gcc', true),
  ('SA', 'Saudi Arabia', 'gcc', true),
  ('IN', 'India', 'india', true);

insert into public.shipping_zones (id, market_id, name)
values
  ('uk', 'uk', 'United Kingdom'),
  ('europe', 'europe', 'Europe'),
  ('usa', 'usa', 'United States'),
  ('gcc', 'gcc', 'GCC'),
  ('india', 'india', 'India');

insert into public.shipping_zone_countries (country_code, zone_id, market_id)
values
  ('GB', 'uk', 'uk'),
  ('DE', 'europe', 'europe'),
  ('FR', 'europe', 'europe'),
  ('US', 'usa', 'usa'),
  ('AE', 'gcc', 'gcc'),
  ('SA', 'gcc', 'gcc'),
  ('IN', 'india', 'india');

insert into public.shipping_methods (
  id,
  zone_id,
  code,
  label,
  estimated_delivery,
  is_active
)
values (
  'uk-standard',
  'uk',
  'standard',
  'UK Standard Delivery',
  '2+ weeks',
  true
);

insert into public.shipping_rates (method_id, currency_code, amount_minor)
values ('uk-standard', 'GBP', 465);

alter table public.currencies enable row level security;
alter table public.markets enable row level security;
alter table public.market_payment_methods enable row level security;
alter table public.countries enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_zone_countries enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.fx_rates enable row level security;

-- Live projects grant anon and authenticated every privilege, including
-- TRUNCATE, on new public tables. RLS does not cover TRUNCATE. Revoke that
-- default before the least-privilege grants below.
revoke all on table
  public.currencies,
  public.markets,
  public.market_payment_methods,
  public.countries,
  public.shipping_zones,
  public.shipping_zone_countries,
  public.shipping_methods,
  public.shipping_rates,
  public.fx_rates
from anon, authenticated;

grant select on table
  public.currencies,
  public.markets,
  public.market_payment_methods,
  public.countries,
  public.shipping_zones,
  public.shipping_zone_countries,
  public.shipping_methods,
  public.shipping_rates
to anon;

grant select, insert, update, delete on table
  public.currencies,
  public.markets,
  public.market_payment_methods,
  public.countries,
  public.shipping_zones,
  public.shipping_zone_countries,
  public.shipping_methods,
  public.shipping_rates
to authenticated;

grant all on table
  public.currencies,
  public.markets,
  public.market_payment_methods,
  public.countries,
  public.shipping_zones,
  public.shipping_zone_countries,
  public.shipping_methods,
  public.shipping_rates
to service_role;

grant select on table public.fx_rates to anon, authenticated;
grant select, insert on table public.fx_rates to service_role;
revoke update, delete, truncate on table public.fx_rates from public, anon, authenticated, service_role;

create policy currencies_public_read
on public.currencies
for select
to anon, authenticated
using (true);

create policy currencies_admin_read
on public.currencies
for select
to authenticated
using ((select private.is_admin()));

create policy currencies_superadmin_insert
on public.currencies
for insert
to authenticated
with check ((select private.is_superadmin()));

create policy currencies_superadmin_update
on public.currencies
for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

create policy currencies_superadmin_delete
on public.currencies
for delete
to authenticated
using ((select private.is_superadmin()));

create policy markets_public_read
on public.markets
for select
to anon, authenticated
using (is_active);

create policy markets_admin_read
on public.markets
for select
to authenticated
using ((select private.is_admin()));

create policy markets_superadmin_insert
on public.markets
for insert
to authenticated
with check ((select private.is_superadmin()));

create policy markets_superadmin_update
on public.markets
for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

create policy markets_superadmin_delete
on public.markets
for delete
to authenticated
using ((select private.is_superadmin()));

create policy market_payment_methods_public_read
on public.market_payment_methods
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.markets
    where markets.id = market_payment_methods.market_id
      and markets.is_active
  )
);

create policy market_payment_methods_admin_read
on public.market_payment_methods
for select
to authenticated
using ((select private.is_admin()));

create policy market_payment_methods_superadmin_insert
on public.market_payment_methods
for insert
to authenticated
with check ((select private.is_superadmin()));

create policy market_payment_methods_superadmin_update
on public.market_payment_methods
for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

create policy market_payment_methods_superadmin_delete
on public.market_payment_methods
for delete
to authenticated
using ((select private.is_superadmin()));

create policy countries_public_read
on public.countries
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.markets
    where markets.id = countries.market_id
      and markets.is_active
  )
);

create policy countries_admin_read
on public.countries
for select
to authenticated
using ((select private.is_admin()));

create policy countries_superadmin_insert
on public.countries
for insert
to authenticated
with check ((select private.is_superadmin()));

create policy countries_superadmin_update
on public.countries
for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

create policy countries_superadmin_delete
on public.countries
for delete
to authenticated
using ((select private.is_superadmin()));

create policy shipping_zones_public_read
on public.shipping_zones
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.markets
    where markets.id = shipping_zones.market_id
      and markets.is_active
  )
);

create policy shipping_zones_admin_read
on public.shipping_zones
for select
to authenticated
using ((select private.is_admin()));

create policy shipping_zones_superadmin_insert
on public.shipping_zones
for insert
to authenticated
with check ((select private.is_superadmin()));

create policy shipping_zones_superadmin_update
on public.shipping_zones
for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

create policy shipping_zones_superadmin_delete
on public.shipping_zones
for delete
to authenticated
using ((select private.is_superadmin()));

create policy shipping_zone_countries_public_read
on public.shipping_zone_countries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.countries
    join public.markets on markets.id = countries.market_id
    where countries.code = shipping_zone_countries.country_code
      and countries.is_active
      and markets.is_active
  )
);

create policy shipping_zone_countries_admin_read
on public.shipping_zone_countries
for select
to authenticated
using ((select private.is_admin()));

create policy shipping_zone_countries_superadmin_insert
on public.shipping_zone_countries
for insert
to authenticated
with check ((select private.is_superadmin()));

create policy shipping_zone_countries_superadmin_update
on public.shipping_zone_countries
for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

create policy shipping_zone_countries_superadmin_delete
on public.shipping_zone_countries
for delete
to authenticated
using ((select private.is_superadmin()));

create policy shipping_methods_public_read
on public.shipping_methods
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.shipping_zones
    join public.markets on markets.id = shipping_zones.market_id
    where shipping_zones.id = shipping_methods.zone_id
      and markets.is_active
  )
);

create policy shipping_methods_admin_read
on public.shipping_methods
for select
to authenticated
using ((select private.is_admin()));

create policy shipping_methods_superadmin_insert
on public.shipping_methods
for insert
to authenticated
with check ((select private.is_superadmin()));

create policy shipping_methods_superadmin_update
on public.shipping_methods
for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

create policy shipping_methods_superadmin_delete
on public.shipping_methods
for delete
to authenticated
using ((select private.is_superadmin()));

create policy shipping_rates_public_read
on public.shipping_rates
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.shipping_methods
    join public.shipping_zones on shipping_zones.id = shipping_methods.zone_id
    join public.markets on markets.id = shipping_zones.market_id
    where shipping_methods.id = shipping_rates.method_id
      and shipping_methods.is_active
      and markets.is_active
  )
);

create policy shipping_rates_admin_read
on public.shipping_rates
for select
to authenticated
using ((select private.is_admin()));

create policy shipping_rates_superadmin_insert
on public.shipping_rates
for insert
to authenticated
with check ((select private.is_superadmin()));

create policy shipping_rates_superadmin_update
on public.shipping_rates
for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

create policy shipping_rates_superadmin_delete
on public.shipping_rates
for delete
to authenticated
using ((select private.is_superadmin()));

create policy fx_rates_public_read
on public.fx_rates
for select
to anon, authenticated
using (status = 'active');

create policy fx_rates_admin_read
on public.fx_rates
for select
to authenticated
using ((select private.is_admin()));

commit;

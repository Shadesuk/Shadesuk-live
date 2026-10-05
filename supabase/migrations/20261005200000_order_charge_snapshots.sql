-- Phase 7. A captured checkout keeps a write-once snapshot of the charge.
-- Orders stay GBP. The snapshot stores the payment currency, the FX rate
-- value, the frozen quote, the shipping rate, and the line items.
-- Corrections are new rows. This migration is not applied until Syed says so.

alter table public.payments
  add column if not exists fx_rate text,
  add column if not exists fx_version integer,
  add column if not exists charge_subtotal_minor integer,
  add column if not exists charge_shipping_minor integer,
  add column if not exists shipping_method_id text,
  add column if not exists shipping_label text,
  add column if not exists estimated_delivery text;

alter table public.payments drop constraint if exists payments_fx_rate_not_blank;
alter table public.payments
  add constraint payments_fx_rate_not_blank
  check (fx_rate is null or btrim(fx_rate) <> '');

alter table public.payments drop constraint if exists payments_fx_version_positive;
alter table public.payments
  add constraint payments_fx_version_positive
  check (fx_version is null or fx_version > 0);

alter table public.payments drop constraint if exists payments_charge_parts_nonnegative;
alter table public.payments
  add constraint payments_charge_parts_nonnegative
  check (
    (charge_subtotal_minor is null or charge_subtotal_minor >= 0)
    and (charge_shipping_minor is null or charge_shipping_minor >= 0)
  );

alter table public.payments drop constraint if exists payments_shipping_text_not_blank;
alter table public.payments
  add constraint payments_shipping_text_not_blank
  check (
    (shipping_method_id is null or btrim(shipping_method_id) <> '')
    and (shipping_label is null or btrim(shipping_label) <> '')
    and (estimated_delivery is null or btrim(estimated_delivery) <> '')
  );

comment on column public.payments.fx_rate is
  'Rate value copied from the quote lock. Null for a GBP PayPal charge with no FX. Not a live lookup.';

create table public.order_charge_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  destination_country text not null,
  order_currency text not null,
  subtotal_minor integer not null,
  shipping_minor integer not null,
  tax_minor integer not null,
  discount_minor integer not null,
  order_total_minor integer not null,
  payment_provider text not null,
  charge_currency text not null,
  charge_subtotal_minor integer not null,
  charge_shipping_minor integer not null,
  charge_total_minor integer not null,
  shipping_method_id text,
  shipping_label text,
  estimated_delivery text,
  delivery_address jsonb not null,
  fx_rate_id text,
  fx_version integer,
  fx_rate text,
  quote_frozen_at timestamptz,
  lines jsonb not null,
  created_at timestamptz not null default now(),
  constraint order_charge_snapshots_country_code check (destination_country ~ '^[A-Z]{2}$'),
  constraint order_charge_snapshots_order_gbp check (order_currency = 'GBP'),
  constraint order_charge_snapshots_tax_discount_zero check (tax_minor = 0 and discount_minor = 0),
  constraint order_charge_snapshots_order_total check (
    order_total_minor = subtotal_minor + shipping_minor + tax_minor - discount_minor
    and subtotal_minor >= 0
    and shipping_minor >= 0
    and order_total_minor > 0
  ),
  constraint order_charge_snapshots_charge_parts check (
    charge_total_minor = charge_subtotal_minor + charge_shipping_minor
    and charge_subtotal_minor >= 0
    and charge_shipping_minor >= 0
    and charge_total_minor > 0
  ),
  constraint order_charge_snapshots_provider_currency check (
    (
      payment_provider = 'paypal'
      and charge_currency = 'GBP'
      and charge_total_minor = order_total_minor
    )
    or (
      payment_provider = 'razorpay'
      and charge_currency = 'INR'
      and fx_rate_id is not null
      and btrim(fx_rate_id) <> ''
      and fx_rate is not null
      and btrim(fx_rate) <> ''
      and fx_version is not null
      and fx_version > 0
      and quote_frozen_at is not null
    )
  ),
  constraint order_charge_snapshots_address_object check (
    jsonb_typeof(delivery_address) = 'object'
    and delivery_address <> '{}'::jsonb
  ),
  constraint order_charge_snapshots_lines_array check (
    jsonb_typeof(lines) = 'array'
    and jsonb_array_length(lines) > 0
  ),
  constraint order_charge_snapshots_text_not_blank check (
    (shipping_method_id is null or btrim(shipping_method_id) <> '')
    and (shipping_label is null or btrim(shipping_label) <> '')
    and (estimated_delivery is null or btrim(estimated_delivery) <> '')
    and (fx_rate_id is null or btrim(fx_rate_id) <> '')
    and (fx_rate is null or btrim(fx_rate) <> '')
  )
);

comment on table public.order_charge_snapshots is
  'Write-once charge record. Inserted in the capture transaction. Provider credentials and event bodies are not stored. Confirmation email still formats the GBP order total.';

create index order_charge_snapshots_order_id_idx
  on public.order_charge_snapshots (order_id);

alter table public.order_charge_snapshots enable row level security;

revoke all on table public.order_charge_snapshots from public;
revoke all on table public.order_charge_snapshots from anon;
revoke all on table public.order_charge_snapshots from authenticated;
revoke update, delete, truncate on table public.order_charge_snapshots from service_role;
grant select, insert on table public.order_charge_snapshots to service_role;

create or replace function private.order_charge_snapshots_write_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'order_charge_snapshots are write-once';
end;
$$;

create trigger order_charge_snapshots_no_update
before update or delete on public.order_charge_snapshots
for each row
execute function private.order_charge_snapshots_write_once();

create trigger order_charge_snapshots_no_truncate
before truncate on public.order_charge_snapshots
for each statement
execute function private.order_charge_snapshots_write_once();

revoke all on function private.order_charge_snapshots_write_once() from public, anon, authenticated;

create or replace function private.insert_order_charge_snapshot(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_country text;
  v_lines jsonb;
  v_charge_subtotal integer;
  v_charge_shipping integer;
begin
  if exists (
    select 1 from public.order_charge_snapshots where payment_id = p_payment_id
  ) then
    return;
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'snapshot payment is missing';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id;
  if not found or v_order.currency is distinct from 'GBP' then
    raise exception 'snapshot order is not a GBP order';
  end if;

  v_country := upper(btrim(coalesce(v_order.delivery_address->>'country', '')));
  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'snapshot destination country is missing';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sku', item.sku,
        'product_name', item.product_name,
        'colour_name', item.colour_name,
        'variant_name', item.variant_name,
        'quantity', item.quantity,
        'unit_price_minor', item.unit_price_minor,
        'line_total_minor', item.line_total_minor
      )
      order by item.created_at
    ),
    '[]'::jsonb
  )
  into v_lines
  from public.order_items item
  where item.order_id = v_order.id;

  if v_payment.provider = 'razorpay' then
    v_charge_subtotal := v_payment.charge_subtotal_minor;
    v_charge_shipping := v_payment.charge_shipping_minor;
  else
    v_charge_subtotal := coalesce(v_payment.charge_subtotal_minor, v_order.subtotal_minor);
    v_charge_shipping := coalesce(v_payment.charge_shipping_minor, v_order.shipping_minor);
  end if;

  insert into public.order_charge_snapshots (
    order_id,
    payment_id,
    destination_country,
    order_currency,
    subtotal_minor,
    shipping_minor,
    tax_minor,
    discount_minor,
    order_total_minor,
    payment_provider,
    charge_currency,
    charge_subtotal_minor,
    charge_shipping_minor,
    charge_total_minor,
    shipping_method_id,
    shipping_label,
    estimated_delivery,
    delivery_address,
    fx_rate_id,
    fx_version,
    fx_rate,
    quote_frozen_at,
    lines
  ) values (
    v_order.id,
    v_payment.id,
    v_country,
    'GBP',
    v_order.subtotal_minor,
    v_order.shipping_minor,
    0,
    0,
    v_order.total_minor,
    v_payment.provider,
    v_payment.currency,
    v_charge_subtotal,
    v_charge_shipping,
    v_payment.amount_minor,
    nullif(btrim(coalesce(v_payment.shipping_method_id, '')), ''),
    nullif(btrim(coalesce(v_payment.shipping_label, '')), ''),
    nullif(btrim(coalesce(v_payment.estimated_delivery, '')), ''),
    v_order.delivery_address,
    nullif(btrim(coalesce(v_payment.fx_rate_id, '')), ''),
    v_payment.fx_version,
    nullif(btrim(coalesce(v_payment.fx_rate, '')), ''),
    v_payment.quote_frozen_at,
    v_lines
  );
end;
$$;

revoke all on function private.insert_order_charge_snapshot(uuid) from public, anon, authenticated;

create or replace function public.mark_india_payment_captured(
  p_payment_id uuid,
  p_order_id uuid,
  p_provider_payment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  if p_provider_payment_id is null or p_provider_payment_id !~ '^pay_[A-Za-z0-9]+$' then
    return jsonb_build_object('status', 'rejected');
  end if;

  select *
    into v_payment
  from public.payments
  where id = p_payment_id
    and order_id = p_order_id
    and provider = 'razorpay'
  for update;

  if not found then
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_payment.captured_at is not null or v_payment.status = 'captured' then
    if v_payment.provider_payment_id = p_provider_payment_id then
      perform private.insert_order_charge_snapshot(v_payment.id);
      return jsonb_build_object('status', 'duplicate');
    end if;
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_payment.status not in ('created', 'authorized') then
    return jsonb_build_object('status', 'rejected');
  end if;

  update public.payments
  set status = 'captured',
      captured_at = now(),
      provider_payment_id = p_provider_payment_id,
      updated_at = now()
  where id = v_payment.id;

  update public.orders
  set payment_status = 'captured',
      status = 'placed',
      updated_at = now()
  where id = p_order_id
    and currency = 'GBP'
    and payment_status = 'created'
    and status = 'checkout';

  if not found then
    raise exception 'india order was not an open GBP checkout';
  end if;

  perform private.insert_order_charge_snapshot(v_payment.id);
  return jsonb_build_object('status', 'captured');
end;
$$;

revoke all on function public.mark_india_payment_captured(uuid, uuid, text) from public;
revoke all on function public.mark_india_payment_captured(uuid, uuid, text) from anon;
revoke all on function public.mark_india_payment_captured(uuid, uuid, text) from authenticated;
grant execute on function public.mark_india_payment_captured(uuid, uuid, text) to service_role;

comment on function public.mark_india_payment_captured(uuid, uuid, text) is
  'Captures the Razorpay payment, places the GBP order, and inserts the write-once charge snapshot in one transaction.';

create or replace function public.mark_paypal_payment_captured(
  p_payment_id uuid,
  p_provider_payment_id text,
  p_provider_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  if p_provider_payment_id is null or btrim(p_provider_payment_id) = ''
    or p_provider_order_id is null or btrim(p_provider_order_id) = ''
  then
    return jsonb_build_object('status', 'rejected');
  end if;

  select *
    into v_payment
  from public.payments
  where id = p_payment_id
    and provider = 'paypal'
  for update;

  if not found then
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_payment.captured_at is not null or v_payment.status = 'captured' then
    if v_payment.provider_payment_id is not distinct from p_provider_payment_id
      and v_payment.provider_order_id is not distinct from p_provider_order_id
    then
      perform private.insert_order_charge_snapshot(v_payment.id);
      return jsonb_build_object('status', 'duplicate');
    end if;
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_payment.status not in ('created', 'authorized')
    or v_payment.provider_order_id is distinct from p_provider_order_id
    or (
      v_payment.provider_payment_id is not null
      and v_payment.provider_payment_id is distinct from p_provider_payment_id
    )
  then
    return jsonb_build_object('status', 'rejected');
  end if;

  update public.payments
  set status = 'captured',
      captured_at = now(),
      provider_payment_id = p_provider_payment_id,
      updated_at = now()
  where id = v_payment.id
    and provider = 'paypal'
    and status in ('created', 'authorized')
    and captured_at is null;

  if not found then
    raise exception 'paypal payment was not open';
  end if;

  update public.orders
  set payment_status = 'captured',
      status = case when status = 'checkout' then 'placed'::public.order_status else status end,
      updated_at = now()
  where id = v_payment.order_id
    and currency = 'GBP'
    and payment_status in ('created', 'authorized');

  if not found then
    raise exception 'paypal order was not an open GBP checkout';
  end if;

  perform private.insert_order_charge_snapshot(v_payment.id);
  return jsonb_build_object('status', 'captured');
end;
$$;

revoke all on function public.mark_paypal_payment_captured(uuid, text, text) from public;
revoke all on function public.mark_paypal_payment_captured(uuid, text, text) from anon;
revoke all on function public.mark_paypal_payment_captured(uuid, text, text) from authenticated;
grant execute on function public.mark_paypal_payment_captured(uuid, text, text) to service_role;

comment on function public.mark_paypal_payment_captured(uuid, text, text) is
  'Captures the PayPal payment, places the GBP order, and inserts the write-once charge snapshot in one transaction.';

create or replace function public.insert_india_checkout_attempt(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_payment_id uuid;
  v_item jsonb;
  v_reference text;
begin
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then
    return jsonb_build_object('status', 'rejected');
  end if;
  if coalesce(p_payload->>'provider', '') is distinct from 'razorpay'
    or coalesce(p_payload->>'charge_currency', '') is distinct from 'INR'
    or coalesce(p_payload->>'order_currency', '') is distinct from 'GBP'
    or coalesce(btrim(p_payload->>'fx_rate_id'), '') = ''
    or coalesce(btrim(p_payload->>'fx_rate'), '') = ''
    or coalesce(p_payload->>'quote_frozen_at', '') = ''
    or coalesce(p_payload->>'order_reference', '') = ''
    or coalesce(btrim(p_payload->>'shipping_method_id'), '') = ''
    or coalesce(btrim(p_payload->>'shipping_label'), '') = ''
    or coalesce(btrim(p_payload->>'estimated_delivery'), '') = ''
    or jsonb_typeof(p_payload->'items') is distinct from 'array'
    or jsonb_array_length(p_payload->'items') < 1
    or jsonb_typeof(p_payload->'delivery_address') is distinct from 'object'
  then
    return jsonb_build_object('status', 'rejected');
  end if;
  if (p_payload->>'subtotal_minor')::integer < 0
    or (p_payload->>'shipping_minor')::integer < 0
    or (p_payload->>'amount_minor')::integer < 1
    or (p_payload->>'fx_version')::integer < 1
    or (p_payload->>'charge_subtotal_minor')::integer < 0
    or (p_payload->>'charge_shipping_minor')::integer < 0
    or (p_payload->>'total_minor')::integer
      is distinct from (p_payload->>'subtotal_minor')::integer + (p_payload->>'shipping_minor')::integer
    or (p_payload->>'charge_subtotal_minor')::integer + (p_payload->>'charge_shipping_minor')::integer
      is distinct from (p_payload->>'amount_minor')::integer
  then
    return jsonb_build_object('status', 'rejected');
  end if;

  v_reference := p_payload->>'order_reference';
  insert into public.orders (
    order_reference,
    user_id,
    customer_email,
    customer_first_name,
    customer_last_name,
    status,
    payment_status,
    currency,
    subtotal_minor,
    shipping_minor,
    total_minor,
    delivery_address
  ) values (
    v_reference,
    nullif(p_payload->>'user_id', '')::uuid,
    p_payload->>'customer_email',
    p_payload->>'customer_first_name',
    p_payload->>'customer_last_name',
    'checkout',
    'created',
    'GBP',
    (p_payload->>'subtotal_minor')::integer,
    (p_payload->>'shipping_minor')::integer,
    (p_payload->>'total_minor')::integer,
    p_payload->'delivery_address'
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_payload->'items')
  loop
    insert into public.order_items (
      order_id,
      product_id,
      product_variant_id,
      sku,
      product_name,
      colour_name,
      variant_name,
      quantity,
      unit_price_minor,
      line_total_minor,
      product_snapshot
    ) values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      nullif(v_item->>'product_variant_id', '')::uuid,
      v_item->>'sku',
      v_item->>'product_name',
      v_item->>'colour_name',
      nullif(v_item->>'variant_name', ''),
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price_minor')::integer,
      (v_item->>'line_total_minor')::integer,
      v_item->'product_snapshot'
    );
  end loop;

  insert into public.payments (
    order_id,
    provider,
    amount_minor,
    currency,
    status,
    fx_rate_id,
    fx_rate,
    fx_version,
    quote_frozen_at,
    charge_subtotal_minor,
    charge_shipping_minor,
    shipping_method_id,
    shipping_label,
    estimated_delivery,
    provider_order_id,
    provider_payment_id,
    failure_reason,
    captured_at
  ) values (
    v_order_id,
    'razorpay',
    (p_payload->>'amount_minor')::integer,
    'INR',
    'created',
    p_payload->>'fx_rate_id',
    p_payload->>'fx_rate',
    (p_payload->>'fx_version')::integer,
    (p_payload->>'quote_frozen_at')::timestamptz,
    (p_payload->>'charge_subtotal_minor')::integer,
    (p_payload->>'charge_shipping_minor')::integer,
    p_payload->>'shipping_method_id',
    p_payload->>'shipping_label',
    p_payload->>'estimated_delivery',
    null,
    null,
    null,
    null
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'status', 'created',
    'order_id', v_order_id,
    'payment_id', v_payment_id,
    'order_reference', v_reference
  );
end;
$$;

revoke all on function public.insert_india_checkout_attempt(jsonb) from public;
revoke all on function public.insert_india_checkout_attempt(jsonb) from anon;
revoke all on function public.insert_india_checkout_attempt(jsonb) from authenticated;
grant execute on function public.insert_india_checkout_attempt(jsonb) to service_role;

comment on function public.mark_india_payment_failed(uuid, text) is
  'Closes an unpaid India attempt by setting payments.status and orders.payment_status to failed. It does not capture, delete the row, or write a charge snapshot.';

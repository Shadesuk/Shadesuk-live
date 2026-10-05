-- Phase 6 follow-up. One transaction for an India attempt, and INR only
-- when the row is a Razorpay charge tied to a quote lock.
-- Orders stay GBP. Historical GBP rows, including old razorpay rows, stay valid.

alter table public.payments drop constraint if exists payments_currency_v1;

alter table public.payments
  add constraint payments_currency_v1
  check (
    currency = 'GBP'
    or (
      currency = 'INR'
      and provider = 'razorpay'
      and fx_rate_id is not null
      and btrim(fx_rate_id) <> ''
      and quote_frozen_at is not null
    )
  );

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
    or coalesce(p_payload->>'quote_frozen_at', '') = ''
    or coalesce(p_payload->>'order_reference', '') = ''
    or jsonb_typeof(p_payload->'items') is distinct from 'array'
    or jsonb_array_length(p_payload->'items') < 1
    or jsonb_typeof(p_payload->'delivery_address') is distinct from 'object'
  then
    return jsonb_build_object('status', 'rejected');
  end if;
  if (p_payload->>'subtotal_minor')::integer < 0
    or (p_payload->>'shipping_minor')::integer < 0
    or (p_payload->>'amount_minor')::integer < 1
    or (p_payload->>'total_minor')::integer
      is distinct from (p_payload->>'subtotal_minor')::integer + (p_payload->>'shipping_minor')::integer
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
    quote_frozen_at,
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
    (p_payload->>'quote_frozen_at')::timestamptz,
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

comment on function public.insert_india_checkout_attempt(jsonb) is
  'Creates the GBP order, items, and INR Razorpay payment in one transaction. A failed item insert does not leave an order.';

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

  return jsonb_build_object('status', 'captured');
end;
$$;

revoke all on function public.mark_india_payment_captured(uuid, uuid, text) from public;
revoke all on function public.mark_india_payment_captured(uuid, uuid, text) from anon;
revoke all on function public.mark_india_payment_captured(uuid, uuid, text) from authenticated;
grant execute on function public.mark_india_payment_captured(uuid, uuid, text) to service_role;

comment on function public.mark_india_payment_captured(uuid, uuid, text) is
  'Captures the Razorpay payment and places the GBP order together. A failed order update rolls back the payment update.';

create or replace function public.mark_india_payment_failed(
  p_payment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_reason text;
begin
  select *
    into v_payment
  from public.payments
  where id = p_payment_id
    and provider = 'razorpay'
  for update;

  if not found or v_payment.captured_at is not null or v_payment.status = 'captured' then
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_payment.status not in ('created', 'authorized') then
    return jsonb_build_object('status', 'rejected');
  end if;

  v_reason := left(coalesce(p_reason, 'Payment could not be completed.'), 280);

  update public.payments
  set status = 'failed',
      failure_reason = v_reason,
      updated_at = now()
  where id = v_payment.id;

  update public.orders
  set payment_status = 'failed',
      updated_at = now()
  where id = v_payment.order_id
    and status = 'checkout'
    and payment_status in ('created', 'authorized');

  return jsonb_build_object('status', 'failed');
end;
$$;

revoke all on function public.mark_india_payment_failed(uuid, text) from public;
revoke all on function public.mark_india_payment_failed(uuid, text) from anon;
revoke all on function public.mark_india_payment_failed(uuid, text) from authenticated;
grant execute on function public.mark_india_payment_failed(uuid, text) to service_role;

comment on function public.mark_india_payment_failed(uuid, text) is
  'Closes an unpaid India attempt. The order leaves payment_status created so it is not an open checkout.';

-- Operational cancellation vs dispatch.
-- The customer window is 12 hours from orders.created_at, and it also closes
-- when a shipping confirmation is recorded. Whichever happens first wins.
-- This does not encode statutory UK consumer rights.
--
-- Service role only. The application verifies account ownership or a guest
-- tracking grant before it calls the function.

create or replace function public.enforce_shipment_requires_captured_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_payment public.payment_status;
begin
  if new.shipped_at is null and new.status not in (
    'dispatched',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'tracking_unavailable'
  ) then
    return new;
  end if;

  select payment_status
    into v_payment
  from public.orders
  where id = new.order_id
  for update;

  if v_payment is distinct from 'captured' then
    raise exception 'order_not_dispatchable'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists shipments_require_captured_payment on public.shipments;

create trigger shipments_require_captured_payment
  before insert or update on public.shipments
  for each row
  execute function public.enforce_shipment_requires_captured_payment();

create or replace function public.cancel_order_if_eligible(
  p_order_id uuid,
  p_actor_user_id uuid,
  p_actor_kind text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_shipment public.shipments%rowtype;
  v_capture_id text;
  v_amount integer;
  v_reason text;
begin
  if p_actor_kind is null or p_actor_kind not in ('customer', 'guest') then
    return jsonb_build_object('status', 'invalid');
  end if;

  select *
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_order.payment_status in ('cancelled', 'refunded') then
    return jsonb_build_object('status', 'already_cancelled');
  end if;

  if v_order.payment_status = 'partially_refunded' then
    return jsonb_build_object('status', 'ineligible', 'reason', 'already_adjusted');
  end if;

  if v_order.payment_status is distinct from 'captured' or v_order.status = 'checkout' then
    return jsonb_build_object('status', 'ineligible', 'reason', 'not_a_purchase');
  end if;

  if v_order.created_at + interval '12 hours' <= now() then
    return jsonb_build_object('status', 'ineligible', 'reason', 'window_closed');
  end if;

  select *
    into v_shipment
  from public.shipments
  where order_id = p_order_id
  for update;

  if found and (
    v_shipment.shipped_at is not null
    or v_shipment.status in (
      'dispatched',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'tracking_unavailable'
    )
  ) then
    return jsonb_build_object('status', 'ineligible', 'reason', 'already_shipped');
  end if;

  if v_order.status in ('dispatched', 'in_transit', 'out_for_delivery', 'delivered') then
    return jsonb_build_object('status', 'ineligible', 'reason', 'already_shipped');
  end if;

  select provider_payment_id, amount_minor
    into v_capture_id, v_amount
  from public.payments
  where order_id = p_order_id
    and status = 'captured'
    and provider = 'paypal'
    and provider_payment_id is not null
  order by created_at desc
  limit 1;

  update public.orders
  set payment_status = 'refunded',
      updated_at = now()
  where id = p_order_id;

  update public.payments
  set status = 'refunded',
      updated_at = now()
  where order_id = p_order_id
    and status = 'captured';

  v_reason := nullif(left(btrim(coalesce(p_reason, '')), 500), '');

  insert into public.order_events (
    order_id,
    event_type,
    old_status,
    new_status,
    actor_user_id,
    metadata,
    customer_visible
  ) values (
    p_order_id,
    'order_cancellation_requested',
    v_order.status,
    v_order.status,
    p_actor_user_id,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_kind', p_actor_kind,
      'reason', v_reason,
      'previous_payment_status', v_order.payment_status,
      'final_payment_status', 'refunded',
      'payment_action', 'refund_required',
      'requested_at', now()
    )),
    true
  );

  return jsonb_build_object(
    'status', 'cancelled',
    'previous_payment_status', v_order.payment_status,
    'final_payment_status', 'refunded',
    'payment_action', 'refund_required',
    'previous_order_status', v_order.status,
    'capture_id', v_capture_id,
    'amount_minor', v_amount
  );
end;
$$;

revoke all on function public.cancel_order_if_eligible(uuid, uuid, text, text) from public;
revoke all on function public.cancel_order_if_eligible(uuid, uuid, text, text) from anon;
revoke all on function public.cancel_order_if_eligible(uuid, uuid, text, text) from authenticated;
grant execute on function public.cancel_order_if_eligible(uuid, uuid, text, text) to service_role;

comment on function public.cancel_order_if_eligible(uuid, uuid, text, text) is
  'Locks the order and any shipment, then marks a captured PayPal order refunded only inside the 12-hour window and before shipping confirmation. Dispatch of a non-captured order is rejected by shipments_require_captured_payment.';

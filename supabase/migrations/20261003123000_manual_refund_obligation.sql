-- Manual refund obligation.
-- Cancelling a captured order records REFUND_PENDING. It does not call PayPal
-- and it does not set payment_status to refunded. An admin marks REFUNDED only
-- after the refund has been completed in PayPal.
-- A cancelled or refund-tracked order stays undispatchable while payment may
-- still read as captured.

alter table public.orders
  add column cancelled_at timestamptz,
  add column refund_status text,
  add column refund_amount_minor integer,
  add column refund_payment_reference text,
  add column refund_marked_at timestamptz,
  add column refund_marked_by uuid references auth.users (id) on delete set null;

alter table public.orders
  add constraint orders_refund_status_known check (
    refund_status is null or refund_status in ('refund_pending', 'refunded')
  ),
  add constraint orders_refund_requires_cancellation check (
    refund_status is null or cancelled_at is not null
  ),
  add constraint orders_refunded_requires_confirmation check (
    refund_status is distinct from 'refunded'
    or (refund_marked_at is not null and refund_marked_by is not null)
  ),
  add constraint orders_refund_amount_nonnegative check (
    refund_amount_minor is null or refund_amount_minor >= 0
  ),
  add constraint orders_refund_payment_reference_not_blank check (
    refund_payment_reference is null or btrim(refund_payment_reference) <> ''
  );

create index orders_refund_pending_idx
  on public.orders (cancelled_at)
  where refund_status = 'refund_pending';

create or replace function public.enforce_shipment_requires_captured_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_payment public.payment_status;
  v_cancelled timestamptz;
  v_refund text;
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

  select payment_status, cancelled_at, refund_status
    into v_payment, v_cancelled, v_refund
  from public.orders
  where id = new.order_id
  for update;

  if v_cancelled is not null or v_refund in ('refund_pending', 'refunded') then
    raise exception 'order_not_dispatchable'
      using errcode = 'P0001';
  end if;

  if v_payment is distinct from 'captured' then
    raise exception 'order_not_dispatchable'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

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
  v_refund text;
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

  if v_order.cancelled_at is not null or v_order.refund_status is not null then
    return jsonb_build_object('status', 'already_cancelled');
  end if;

  if v_order.payment_status in ('cancelled', 'refunded') then
    return jsonb_build_object('status', 'already_cancelled');
  end if;

  if v_order.payment_status = 'partially_refunded' then
    return jsonb_build_object('status', 'ineligible', 'reason', 'already_adjusted');
  end if;

  if v_order.status = 'checkout'
    or v_order.payment_status not in ('captured', 'created', 'authorized') then
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

  v_reason := nullif(left(btrim(coalesce(p_reason, '')), 500), '');

  if v_order.payment_status = 'captured' then
    select provider_payment_id, amount_minor
      into v_capture_id, v_amount
    from public.payments
    where order_id = p_order_id
      and status = 'captured'
      and provider = 'paypal'
      and provider_payment_id is not null
    order by created_at desc
    limit 1;

    v_amount := coalesce(v_amount, v_order.total_minor);
    v_capture_id := nullif(btrim(coalesce(v_capture_id, '')), '');
    v_refund := 'refund_pending';

    update public.orders
    set cancelled_at = now(),
        refund_status = 'refund_pending',
        refund_amount_minor = v_amount,
        refund_payment_reference = v_capture_id,
        updated_at = now()
    where id = p_order_id;
  else
    v_amount := null;
    v_capture_id := null;
    v_refund := null;

    update public.orders
    set cancelled_at = now(),
        payment_status = 'cancelled',
        updated_at = now()
    where id = p_order_id;

    update public.payments
    set status = 'cancelled',
        updated_at = now()
    where order_id = p_order_id
      and status in ('created', 'authorized');
  end if;

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
      'order_state', 'cancelled',
      'refund_status', v_refund,
      'payment_action', 'none',
      'amount_minor', v_amount,
      'payment_reference', v_capture_id,
      'cancelled_at', now(),
      'requested_at', now()
    )),
    true
  );

  return jsonb_build_object(
    'status', 'cancelled',
    'order_state', 'cancelled',
    'refund_status', v_refund,
    'payment_action', 'none',
    'previous_order_status', v_order.status,
    'previous_payment_status', v_order.payment_status,
    'amount_minor', v_amount,
    'payment_reference', v_capture_id
  );
end;
$$;

revoke all on function public.cancel_order_if_eligible(uuid, uuid, text, text) from public;
revoke all on function public.cancel_order_if_eligible(uuid, uuid, text, text) from anon;
revoke all on function public.cancel_order_if_eligible(uuid, uuid, text, text) from authenticated;
grant execute on function public.cancel_order_if_eligible(uuid, uuid, text, text) to service_role;

comment on function public.cancel_order_if_eligible(uuid, uuid, text, text) is
  'Locks the order and any shipment, then records cancellation inside the 12-hour window and before shipping confirmation. A captured payment becomes refund_pending for a manual PayPal refund. Unpaid cancellation has no refund obligation. This function does not call PayPal and does not mark the payment refunded.';

create or replace function public.mark_order_refunded(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_amount integer;
  v_reference text;
  v_marked timestamptz;
begin
  if p_actor_user_id is null then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  select *
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_order.refund_status = 'refunded' and v_order.cancelled_at is not null then
    return jsonb_build_object(
      'status', 'already_refunded',
      'amount_minor', v_order.refund_amount_minor,
      'payment_reference', v_order.refund_payment_reference,
      'marked_at', v_order.refund_marked_at,
      'actor_user_id', v_order.refund_marked_by
    );
  end if;

  v_marked := now();

  update public.orders
  set refund_status = 'refunded',
      refund_marked_at = v_marked,
      refund_marked_by = p_actor_user_id,
      updated_at = v_marked
  where id = p_order_id
    and cancelled_at is not null
    and refund_status = 'refund_pending'
  returning refund_amount_minor, refund_payment_reference
  into v_amount, v_reference;

  if not found then
    if v_order.cancelled_at is null then
      return jsonb_build_object('status', 'ineligible', 'reason', 'not_cancelled');
    end if;
    return jsonb_build_object('status', 'ineligible', 'reason', 'not_pending');
  end if;

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
    'order_refund_marked',
    v_order.status,
    v_order.status,
    p_actor_user_id,
    jsonb_strip_nulls(jsonb_build_object(
      'previous_refund_status', 'refund_pending',
      'refund_status', 'refunded',
      'amount_minor', v_amount,
      'payment_reference', v_reference,
      'cancelled_at', v_order.cancelled_at,
      'marked_at', v_marked,
      'actor_user_id', p_actor_user_id
    )),
    false
  );

  return jsonb_build_object(
    'status', 'refunded',
    'amount_minor', v_amount,
    'payment_reference', v_reference,
    'marked_at', v_marked,
    'actor_user_id', p_actor_user_id
  );
end;
$$;

revoke all on function public.mark_order_refunded(uuid, uuid) from public;
revoke all on function public.mark_order_refunded(uuid, uuid) from anon;
revoke all on function public.mark_order_refunded(uuid, uuid) from authenticated;
grant execute on function public.mark_order_refunded(uuid, uuid) to service_role;

comment on function public.mark_order_refunded(uuid, uuid) is
  'Admin confirmation that a PayPal refund was already completed outside this app. Idempotent when the obligation is already refunded. Does not call PayPal and does not change the captured payment reference or amount.';

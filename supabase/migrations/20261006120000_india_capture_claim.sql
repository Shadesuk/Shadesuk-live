-- One open India attempt per order, and a conditional claim before Razorpay capture.
-- Charge snapshots stay as they are. No new foreign keys.

create unique index if not exists payments_one_open_india_attempt_key
  on public.payments (order_id)
  where provider = 'razorpay'
    and status in ('created', 'authorized')
    and captured_at is null;

comment on index public.payments_one_open_india_attempt_key is
  'Each GBP order may have only one open India (Razorpay) payment attempt.';

create or replace function public.claim_india_payment_for_capture(
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
  v_updated integer;
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

  if v_payment.provider_payment_id is not null
    and v_payment.provider_payment_id is distinct from p_provider_payment_id
  then
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_payment.status = 'authorized'
    and v_payment.provider_payment_id = p_provider_payment_id
    and v_payment.updated_at > now() - interval '45 seconds'
  then
    return jsonb_build_object('status', 'in_progress');
  end if;

  update public.payments
  set status = 'authorized',
      provider_payment_id = p_provider_payment_id,
      updated_at = now()
  where id = v_payment.id
    and order_id = p_order_id
    and provider = 'razorpay'
    and captured_at is null
    and (
      (
        status = 'created'
        and (provider_payment_id is null or provider_payment_id = p_provider_payment_id)
      )
      or (
        status = 'authorized'
        and provider_payment_id = p_provider_payment_id
        and updated_at <= now() - interval '45 seconds'
      )
    );

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return jsonb_build_object('status', 'rejected');
  end if;

  return jsonb_build_object('status', 'claimed');
end;
$$;

revoke all on function public.claim_india_payment_for_capture(uuid, uuid, text) from public;
revoke all on function public.claim_india_payment_for_capture(uuid, uuid, text) from anon;
revoke all on function public.claim_india_payment_for_capture(uuid, uuid, text) from authenticated;
grant execute on function public.claim_india_payment_for_capture(uuid, uuid, text) to service_role;

comment on function public.claim_india_payment_for_capture(uuid, uuid, text) is
  'Claims one open India payment before Razorpay capture. The winner stores the provider payment id. A second caller with the same id is in_progress and must not capture again. A different id or a closed attempt is rejected.';

create or replace function public.release_india_capture_claim(
  p_payment_id uuid,
  p_order_id uuid,
  p_provider_payment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_provider_payment_id is null or p_provider_payment_id !~ '^pay_[A-Za-z0-9]+$' then
    return jsonb_build_object('status', 'rejected');
  end if;

  update public.payments
  set status = 'created',
      provider_payment_id = null,
      updated_at = now()
  where id = p_payment_id
    and order_id = p_order_id
    and provider = 'razorpay'
    and status = 'authorized'
    and captured_at is null
    and provider_payment_id = p_provider_payment_id;

  if not found then
    return jsonb_build_object('status', 'rejected');
  end if;

  return jsonb_build_object('status', 'released');
end;
$$;

revoke all on function public.release_india_capture_claim(uuid, uuid, text) from public;
revoke all on function public.release_india_capture_claim(uuid, uuid, text) from anon;
revoke all on function public.release_india_capture_claim(uuid, uuid, text) from authenticated;
grant execute on function public.release_india_capture_claim(uuid, uuid, text) to service_role;

comment on function public.release_india_capture_claim(uuid, uuid, text) is
  'Releases an India capture claim only while the payment is still authorized and uncaptured, so a failed capture can be retried by one caller.';

create or replace function public.flag_india_capture_unrecorded(
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
      return jsonb_build_object('status', 'recorded');
    end if;
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_payment.status not in ('created', 'authorized') then
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_payment.provider_payment_id is not null
    and v_payment.provider_payment_id is distinct from p_provider_payment_id
  then
    return jsonb_build_object('status', 'rejected');
  end if;

  update public.payments
  set failure_reason = 'razorpay_captured_unrecorded',
      updated_at = now()
  where id = v_payment.id
    and captured_at is null
    and status in ('created', 'authorized');

  if not found then
    return jsonb_build_object('status', 'rejected');
  end if;

  return jsonb_build_object('status', 'flagged', 'order_id', p_order_id);
end;
$$;

revoke all on function public.flag_india_capture_unrecorded(uuid, uuid, text) from public;
revoke all on function public.flag_india_capture_unrecorded(uuid, uuid, text) from anon;
revoke all on function public.flag_india_capture_unrecorded(uuid, uuid, text) from authenticated;
grant execute on function public.flag_india_capture_unrecorded(uuid, uuid, text) to service_role;

comment on function public.flag_india_capture_unrecorded(uuid, uuid, text) is
  'Marks an India payment whose Razorpay capture succeeded but the order write failed. Leaves the row open for a retry. Does not place, cancel, or refund the order.';

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

  if v_payment.provider_payment_id is not null
    and v_payment.provider_payment_id is distinct from p_provider_payment_id
  then
    return jsonb_build_object('status', 'rejected');
  end if;

  update public.payments
  set status = 'captured',
      captured_at = now(),
      provider_payment_id = p_provider_payment_id,
      failure_reason = null,
      updated_at = now()
  where id = v_payment.id
    and provider = 'razorpay'
    and status in ('created', 'authorized')
    and captured_at is null
    and (
      provider_payment_id is null
      or provider_payment_id = p_provider_payment_id
    );

  if not found then
    raise exception 'india payment was not open';
  end if;

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
  'Captures the Razorpay payment only while it is still open, places the GBP order, and inserts the write-once charge snapshot in one transaction.';

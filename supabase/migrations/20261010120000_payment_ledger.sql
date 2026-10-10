-- Append-only payment ledger. One charge row per captured provider payment,
-- and one refund row when an admin marks a manual refund.
-- Currency is copied from payments, not from orders.
-- No backfill: production orders were removed before this migration.
-- Settlement and fee rows are not written. There is no source for them.
-- This migration is not applied by the change that adds it.

create table public.payment_ledger (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null,
  entry_type text not null,
  amount_minor integer not null,
  currency text not null,
  provider_ref text not null,
  provider_event_id text,
  occurred_at timestamptz not null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  constraint payment_ledger_provider_not_blank check (btrim(provider) <> ''),
  constraint payment_ledger_entry_type_known check (
    entry_type in ('charge', 'refund', 'fee', 'settlement', 'adjustment')
  ),
  constraint payment_ledger_amount_sign check (
    (entry_type = 'charge' and amount_minor > 0)
    or (entry_type = 'refund' and amount_minor < 0)
    or (entry_type in ('fee', 'settlement', 'adjustment') and amount_minor <> 0)
  ),
  constraint payment_ledger_currency_known check (
    currency in ('GBP', 'EUR', 'USD', 'INR')
  ),
  constraint payment_ledger_provider_ref_not_blank check (btrim(provider_ref) <> ''),
  constraint payment_ledger_provider_event_id_not_blank check (
    provider_event_id is null or btrim(provider_event_id) <> ''
  ),
  constraint payment_ledger_provider_entry_ref_key unique (provider, entry_type, provider_ref)
);

comment on table public.payment_ledger is
  'Append-only payment amounts in the payment currency. Charge rows are written when a payment is captured. Refund rows are written when a manual refund is marked. Fees and settlements are not inferred. Test rows are excluded from admin totals.';

comment on column public.payment_ledger.amount_minor is
  'Signed minor units of currency. A charge is positive. A refund is negative. The currency is payments.currency, not orders.currency.';

comment on column public.payment_ledger.is_test is
  'True only when a writer knows the row is a test. Capture and manual-refund writes set false: payments has no test flag. Admin totals exclude true.';

create index payment_ledger_occurred_at_idx
  on public.payment_ledger (occurred_at desc);

create index payment_ledger_order_id_idx
  on public.payment_ledger (order_id);

alter table public.payment_ledger enable row level security;

revoke all on table public.payment_ledger from public;
revoke all on table public.payment_ledger from anon;
revoke all on table public.payment_ledger from authenticated;
revoke all on table public.payment_ledger from service_role;
grant select on table public.payment_ledger to service_role;

create or replace function private.payment_ledger_deny_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'payment_ledger is append-only';
end;
$$;

create trigger payment_ledger_no_update
before update or delete on public.payment_ledger
for each row
execute function private.payment_ledger_deny_mutation();

create trigger payment_ledger_no_truncate
before truncate on public.payment_ledger
for each statement
execute function private.payment_ledger_deny_mutation();

revoke all on function private.payment_ledger_deny_mutation() from public, anon, authenticated;

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
      insert into public.payment_ledger (
        payment_id,
        order_id,
        provider,
        entry_type,
        amount_minor,
        currency,
        provider_ref,
        provider_event_id,
        occurred_at,
        is_test
      ) values (
        v_payment.id,
        v_payment.order_id,
        v_payment.provider,
        'charge',
        v_payment.amount_minor,
        v_payment.currency,
        p_provider_payment_id,
        null,
        coalesce(v_payment.captured_at, now()),
        false
      )
      on conflict (provider, entry_type, provider_ref) do nothing;
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
  insert into public.payment_ledger (
    payment_id,
    order_id,
    provider,
    entry_type,
    amount_minor,
    currency,
    provider_ref,
    provider_event_id,
    occurred_at,
    is_test
  ) values (
    v_payment.id,
    v_payment.order_id,
    v_payment.provider,
    'charge',
    v_payment.amount_minor,
    v_payment.currency,
    p_provider_payment_id,
    null,
    coalesce(v_payment.captured_at, now()),
    false
  )
  on conflict (provider, entry_type, provider_ref) do nothing;
  return jsonb_build_object('status', 'captured');
end;
$$;

revoke all on function public.mark_india_payment_captured(uuid, uuid, text) from public;
revoke all on function public.mark_india_payment_captured(uuid, uuid, text) from anon;
revoke all on function public.mark_india_payment_captured(uuid, uuid, text) from authenticated;
grant execute on function public.mark_india_payment_captured(uuid, uuid, text) to service_role;

comment on function public.mark_india_payment_captured(uuid, uuid, text) is
  'Captures the Razorpay payment only while it is still open, places the GBP order, inserts the write-once charge snapshot, and inserts one payment_ledger charge in the payment currency. A repeated capture does not add a second charge.';

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
      insert into public.payment_ledger (
        payment_id,
        order_id,
        provider,
        entry_type,
        amount_minor,
        currency,
        provider_ref,
        provider_event_id,
        occurred_at,
        is_test
      ) values (
        v_payment.id,
        v_payment.order_id,
        v_payment.provider,
        'charge',
        v_payment.amount_minor,
        v_payment.currency,
        p_provider_payment_id,
        null,
        coalesce(v_payment.captured_at, now()),
        false
      )
      on conflict (provider, entry_type, provider_ref) do nothing;
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
  insert into public.payment_ledger (
    payment_id,
    order_id,
    provider,
    entry_type,
    amount_minor,
    currency,
    provider_ref,
    provider_event_id,
    occurred_at,
    is_test
  ) values (
    v_payment.id,
    v_payment.order_id,
    v_payment.provider,
    'charge',
    v_payment.amount_minor,
    v_payment.currency,
    p_provider_payment_id,
    null,
    coalesce(v_payment.captured_at, now()),
    false
  )
  on conflict (provider, entry_type, provider_ref) do nothing;
  return jsonb_build_object('status', 'captured');
end;
$$;

revoke all on function public.mark_paypal_payment_captured(uuid, text, text) from public;
revoke all on function public.mark_paypal_payment_captured(uuid, text, text) from anon;
revoke all on function public.mark_paypal_payment_captured(uuid, text, text) from authenticated;
grant execute on function public.mark_paypal_payment_captured(uuid, text, text) to service_role;

comment on function public.mark_paypal_payment_captured(uuid, text, text) is
  'Captures the PayPal payment, places the GBP order, inserts the write-once charge snapshot, and inserts one payment_ledger charge in the payment currency. A repeated capture does not add a second charge.';

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

  insert into public.payment_ledger (
    payment_id,
    order_id,
    provider,
    entry_type,
    amount_minor,
    currency,
    provider_ref,
    provider_event_id,
    occurred_at,
    is_test
  )
  select
    p.id,
    p.order_id,
    p.provider,
    'refund',
    -p.amount_minor,
    p.currency,
    p.provider_payment_id,
    null,
    v_marked,
    false
  from public.payments p
  where p.order_id = p_order_id
    and p.status = 'captured'
    and p.provider_payment_id is not null
    and p.amount_minor > 0
    and (v_reference is null or p.provider_payment_id = v_reference)
  order by p.captured_at desc nulls last
  limit 1
  on conflict (provider, entry_type, provider_ref) do nothing;

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
  'Admin confirmation that a refund was already completed outside this app. Inserts one negative payment_ledger refund in the captured payment currency. Idempotent when the obligation is already refunded. Does not call a provider and does not change the captured payment reference or amount.';

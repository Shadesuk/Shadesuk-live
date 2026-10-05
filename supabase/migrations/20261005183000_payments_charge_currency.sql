-- Phase 6. Orders stay GBP (orders_currency_gbp is unchanged).
-- A new Razorpay row stores the locked INR charge and the FX rate id.
-- Historical provider=razorpay rows may still be GBP; this does not rewrite them.

alter table public.payments drop constraint if exists payments_currency_gbp;

alter table public.payments
  add constraint payments_currency_v1
  check (currency in ('GBP', 'EUR', 'USD', 'INR'));

alter table public.payments
  add column if not exists fx_rate_id text;

alter table public.payments
  add column if not exists quote_frozen_at timestamptz;

alter table public.payments
  drop constraint if exists payments_fx_rate_id_not_blank;

alter table public.payments
  add constraint payments_fx_rate_id_not_blank
  check (fx_rate_id is null or btrim(fx_rate_id) <> '');

comment on column public.payments.fx_rate_id is
  'fx_rates.id copied from the quote lock. Null for PayPal GBP charges.';

comment on column public.payments.quote_frozen_at is
  'Quote lock frozenAt. Razorpay capture rejects the row after 45 minutes.';

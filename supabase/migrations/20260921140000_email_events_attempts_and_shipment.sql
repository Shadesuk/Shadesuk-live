begin;

-- Block 3.2: email_events already has a unique idempotency_key and
-- email_status (pending, sent, failed). Add the minimum missing fields
-- for shipment-scoped events and attempt observability.

alter table public.email_events
  add column if not exists shipment_id uuid references public.shipments (id) on delete set null;

alter table public.email_events
  add column if not exists attempts integer not null default 0;

alter table public.email_events
  drop constraint if exists email_events_attempts_nonnegative;

alter table public.email_events
  add constraint email_events_attempts_nonnegative check (attempts >= 0);

create index if not exists email_events_shipment_id_idx
  on public.email_events (shipment_id)
  where shipment_id is not null;

comment on column public.email_events.idempotency_key is
  'Deterministic business key. Required forms: order_confirmation:{order_id}, shipment_confirmation:{shipment_id}. Unique in Postgres; do not generate random or timestamp keys.';

comment on column public.email_events.shipment_id is
  'Optional shipment for shipment_confirmation events. Order confirmation leaves this null.';

comment on column public.email_events.attempts is
  'Completed send attempts. 0 until the first pending→sent or pending→failed transition.';

comment on column public.email_events.provider_message_id is
  'Provider delivery id (Resend message id). Never store API keys or secrets here.';

comment on column public.email_events.error_message is
  'Sanitized provider or validation error. Never persist secrets.';

commit;

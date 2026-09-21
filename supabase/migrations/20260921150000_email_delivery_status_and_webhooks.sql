begin;

-- Block 3.2A: provider delivery state is separate from application send state.
-- email_status remains pending | sent | failed.

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'email_delivery_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.email_delivery_status as enum (
      'unknown',
      'delivered',
      'bounced',
      'complained'
    );
  end if;
end
$$;

alter table public.email_events
  add column if not exists delivery_status public.email_delivery_status not null default 'unknown';

alter table public.email_events
  add column if not exists delivery_updated_at timestamptz;

comment on column public.email_events.delivery_status is
  'Provider mailbox outcome. Distinct from email_status (application send). unknown until a verified Resend delivery webhook arrives.';

comment on column public.email_events.delivery_updated_at is
  'Provider event created_at for the current delivery_status. Used to ignore stale webhooks.';

create table if not exists public.email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend',
  provider_event_id text not null unique,
  event_type text not null,
  provider_message_id text,
  created_at timestamptz not null default now(),
  constraint email_webhook_events_provider_not_blank check (btrim(provider) <> ''),
  constraint email_webhook_events_provider_event_id_not_blank check (
    btrim(provider_event_id) <> ''
  ),
  constraint email_webhook_events_event_type_not_blank check (btrim(event_type) <> ''),
  constraint email_webhook_events_provider_message_id_not_blank check (
    provider_message_id is null or btrim(provider_message_id) <> ''
  )
);

comment on table public.email_webhook_events is
  'Resend webhook receipts keyed by svix-id. No raw payloads or secrets are stored.';

create index if not exists email_events_provider_message_id_idx
  on public.email_events (provider_message_id)
  where provider_message_id is not null;

create index if not exists email_webhook_events_message_id_idx
  on public.email_webhook_events (provider_message_id)
  where provider_message_id is not null;

revoke all on table public.email_webhook_events from public, anon, authenticated;
grant select on table public.email_webhook_events to authenticated;
grant all on table public.email_webhook_events to service_role;

alter table public.email_webhook_events enable row level security;

drop policy if exists email_webhook_events_admin_read on public.email_webhook_events;
create policy email_webhook_events_admin_read
on public.email_webhook_events
for select
to authenticated
using (private.is_admin());

commit;

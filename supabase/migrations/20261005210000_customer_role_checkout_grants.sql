-- Phase 8. Customer roles cannot read FX rows or payment rows.
-- Checkout reads both through service_role. This migration is not applied here.
-- Apply it with the Phase 6 and Phase 7 migrations, before or with the deploy.

revoke select on table public.fx_rates from public, anon, authenticated;
drop policy if exists fx_rates_public_read on public.fx_rates;

revoke select on table public.payments from public, anon, authenticated;

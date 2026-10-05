-- Move EU member countries that the international seed placed in the
-- international (USD) market onto the existing europe market.
-- DE and FR were already europe in the Phase 1 seed and are left alone.
-- Does not add shipping methods or rates. europe-standard stays £4.65.
-- Non-EU countries stay on international.
-- Do not edit 20261005220000. This file is applied by hand, not by the app.

do $$
declare
  eu text[] := array[
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
    'RO', 'SK', 'SI', 'ES', 'SE'
  ];
begin
  delete from public.shipping_zone_countries
  where country_code = any (eu)
    and market_id = 'international';

  update public.countries
  set market_id = 'europe',
      updated_at = now()
  where code = any (eu)
    and market_id = 'international';

  insert into public.shipping_zone_countries (country_code, zone_id, market_id)
  select countries.code, 'europe', 'europe'
  from public.countries
  where countries.code = any (eu)
    and countries.market_id = 'europe'
  on conflict (country_code) do nothing;
end $$;

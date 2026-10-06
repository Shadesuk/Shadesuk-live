-- International shipping at the existing UK commercial rule, and PayPal EUR/USD charges.
-- Does not edit the applied Phase 1–7 migrations.
-- Catalogue orders stay GBP. Display currencies AED and SAR are pegged to USD in the app
-- and are not written as Frankfurter rows.

insert into public.currencies (code, name, minor_unit_exponent, is_catalogue_base)
values
  ('AUD', 'Australian dollar', 2, false),
  ('BRL', 'Brazilian real', 2, false),
  ('CAD', 'Canadian dollar', 2, false),
  ('CHF', 'Swiss franc', 2, false),
  ('CNY', 'Chinese yuan', 2, false),
  ('HKD', 'Hong Kong dollar', 2, false),
  ('IDR', 'Indonesian rupiah', 2, false),
  ('ILS', 'Israeli shekel', 2, false),
  ('JPY', 'Japanese yen', 0, false),
  ('KRW', 'South Korean won', 0, false),
  ('MXN', 'Mexican peso', 2, false),
  ('MYR', 'Malaysian ringgit', 2, false),
  ('NOK', 'Norwegian krone', 2, false),
  ('NZD', 'New Zealand dollar', 2, false),
  ('PHP', 'Philippine peso', 2, false),
  ('SGD', 'Singapore dollar', 2, false),
  ('THB', 'Thai baht', 2, false),
  ('TRY', 'Turkish lira', 2, false),
  ('ZAR', 'South African rand', 2, false),
  ('AED', 'UAE dirham', 2, false),
  ('SAR', 'Saudi riyal', 2, false)
on conflict (code) do nothing;

insert into public.markets (id, name, currency_code, is_active)
values ('international', 'International', 'USD', true)
on conflict (id) do nothing;

insert into public.market_payment_methods (market_id, currency_code, payment_provider)
values ('international', 'USD', 'paypal')
on conflict (market_id) do nothing;

insert into public.countries (code, name, market_id, is_active)
values
  ('AF', 'Afghanistan', 'international', true),
  ('AL', 'Albania', 'international', true),
  ('DZ', 'Algeria', 'international', true),
  ('AD', 'Andorra', 'international', true),
  ('AO', 'Angola', 'international', true),
  ('AG', 'Antigua and Barbuda', 'international', true),
  ('AR', 'Argentina', 'international', true),
  ('AM', 'Armenia', 'international', true),
  ('AU', 'Australia', 'international', true),
  ('AT', 'Austria', 'international', true),
  ('AZ', 'Azerbaijan', 'international', true),
  ('BS', 'Bahamas', 'international', true),
  ('BH', 'Bahrain', 'international', true),
  ('BD', 'Bangladesh', 'international', true),
  ('BB', 'Barbados', 'international', true),
  ('BY', 'Belarus', 'international', true),
  ('BE', 'Belgium', 'international', true),
  ('BZ', 'Belize', 'international', true),
  ('BJ', 'Benin', 'international', true),
  ('BT', 'Bhutan', 'international', true),
  ('BO', 'Bolivia', 'international', true),
  ('BA', 'Bosnia and Herzegovina', 'international', true),
  ('BW', 'Botswana', 'international', true),
  ('BR', 'Brazil', 'international', true),
  ('BN', 'Brunei', 'international', true),
  ('BG', 'Bulgaria', 'international', true),
  ('BF', 'Burkina Faso', 'international', true),
  ('BI', 'Burundi', 'international', true),
  ('KH', 'Cambodia', 'international', true),
  ('CM', 'Cameroon', 'international', true),
  ('CA', 'Canada', 'international', true),
  ('CV', 'Cabo Verde', 'international', true),
  ('CF', 'Central African Republic', 'international', true),
  ('TD', 'Chad', 'international', true),
  ('CL', 'Chile', 'international', true),
  ('CN', 'China', 'international', true),
  ('CO', 'Colombia', 'international', true),
  ('KM', 'Comoros', 'international', true),
  ('CG', 'Congo', 'international', true),
  ('CR', 'Costa Rica', 'international', true),
  ('CI', 'Côte d''Ivoire', 'international', true),
  ('HR', 'Croatia', 'international', true),
  ('CU', 'Cuba', 'international', true),
  ('CY', 'Cyprus', 'international', true),
  ('CZ', 'Czechia', 'international', true),
  ('DK', 'Denmark', 'international', true),
  ('DJ', 'Djibouti', 'international', true),
  ('DM', 'Dominica', 'international', true),
  ('DO', 'Dominican Republic', 'international', true),
  ('EC', 'Ecuador', 'international', true),
  ('EG', 'Egypt', 'international', true),
  ('SV', 'El Salvador', 'international', true),
  ('GQ', 'Equatorial Guinea', 'international', true),
  ('ER', 'Eritrea', 'international', true),
  ('EE', 'Estonia', 'international', true),
  ('SZ', 'Eswatini', 'international', true),
  ('ET', 'Ethiopia', 'international', true),
  ('FJ', 'Fiji', 'international', true),
  ('FI', 'Finland', 'international', true),
  ('GA', 'Gabon', 'international', true),
  ('GM', 'Gambia', 'international', true),
  ('GE', 'Georgia', 'international', true),
  ('GH', 'Ghana', 'international', true),
  ('GR', 'Greece', 'international', true),
  ('GD', 'Grenada', 'international', true),
  ('GT', 'Guatemala', 'international', true),
  ('GN', 'Guinea', 'international', true),
  ('GW', 'Guinea-Bissau', 'international', true),
  ('GY', 'Guyana', 'international', true),
  ('HT', 'Haiti', 'international', true),
  ('HN', 'Honduras', 'international', true),
  ('HK', 'Hong Kong', 'international', true),
  ('HU', 'Hungary', 'international', true),
  ('IS', 'Iceland', 'international', true),
  ('ID', 'Indonesia', 'international', true),
  ('IR', 'Iran', 'international', true),
  ('IQ', 'Iraq', 'international', true),
  ('IE', 'Ireland', 'international', true),
  ('IL', 'Israel', 'international', true),
  ('IT', 'Italy', 'international', true),
  ('JM', 'Jamaica', 'international', true),
  ('JP', 'Japan', 'international', true),
  ('JO', 'Jordan', 'international', true),
  ('KZ', 'Kazakhstan', 'international', true),
  ('KE', 'Kenya', 'international', true),
  ('KI', 'Kiribati', 'international', true),
  ('KW', 'Kuwait', 'international', true),
  ('KG', 'Kyrgyzstan', 'international', true),
  ('LA', 'Laos', 'international', true),
  ('LV', 'Latvia', 'international', true),
  ('LB', 'Lebanon', 'international', true),
  ('LS', 'Lesotho', 'international', true),
  ('LR', 'Liberia', 'international', true),
  ('LY', 'Libya', 'international', true),
  ('LI', 'Liechtenstein', 'international', true),
  ('LT', 'Lithuania', 'international', true),
  ('LU', 'Luxembourg', 'international', true),
  ('MO', 'Macao', 'international', true),
  ('MG', 'Madagascar', 'international', true),
  ('MW', 'Malawi', 'international', true),
  ('MY', 'Malaysia', 'international', true),
  ('MV', 'Maldives', 'international', true),
  ('ML', 'Mali', 'international', true),
  ('MT', 'Malta', 'international', true),
  ('MH', 'Marshall Islands', 'international', true),
  ('MR', 'Mauritania', 'international', true),
  ('MU', 'Mauritius', 'international', true),
  ('MX', 'Mexico', 'international', true),
  ('FM', 'Micronesia', 'international', true),
  ('MD', 'Moldova', 'international', true),
  ('MC', 'Monaco', 'international', true),
  ('MN', 'Mongolia', 'international', true),
  ('ME', 'Montenegro', 'international', true),
  ('MA', 'Morocco', 'international', true),
  ('MZ', 'Mozambique', 'international', true),
  ('MM', 'Myanmar', 'international', true),
  ('NA', 'Namibia', 'international', true),
  ('NR', 'Nauru', 'international', true),
  ('NP', 'Nepal', 'international', true),
  ('NL', 'Netherlands', 'international', true),
  ('NZ', 'New Zealand', 'international', true),
  ('NI', 'Nicaragua', 'international', true),
  ('NE', 'Niger', 'international', true),
  ('NG', 'Nigeria', 'international', true),
  ('MK', 'North Macedonia', 'international', true),
  ('NO', 'Norway', 'international', true),
  ('OM', 'Oman', 'international', true),
  ('PK', 'Pakistan', 'international', true),
  ('PW', 'Palau', 'international', true),
  ('PA', 'Panama', 'international', true),
  ('PG', 'Papua New Guinea', 'international', true),
  ('PY', 'Paraguay', 'international', true),
  ('PE', 'Peru', 'international', true),
  ('PH', 'Philippines', 'international', true),
  ('PL', 'Poland', 'international', true),
  ('PT', 'Portugal', 'international', true),
  ('QA', 'Qatar', 'international', true),
  ('RO', 'Romania', 'international', true),
  ('RW', 'Rwanda', 'international', true),
  ('KN', 'Saint Kitts and Nevis', 'international', true),
  ('LC', 'Saint Lucia', 'international', true),
  ('VC', 'Saint Vincent and the Grenadines', 'international', true),
  ('WS', 'Samoa', 'international', true),
  ('SM', 'San Marino', 'international', true),
  ('ST', 'Sao Tome and Principe', 'international', true),
  ('SN', 'Senegal', 'international', true),
  ('RS', 'Serbia', 'international', true),
  ('SC', 'Seychelles', 'international', true),
  ('SL', 'Sierra Leone', 'international', true),
  ('SG', 'Singapore', 'international', true),
  ('SK', 'Slovakia', 'international', true),
  ('SI', 'Slovenia', 'international', true),
  ('SB', 'Solomon Islands', 'international', true),
  ('SO', 'Somalia', 'international', true),
  ('ZA', 'South Africa', 'international', true),
  ('KR', 'South Korea', 'international', true),
  ('SS', 'South Sudan', 'international', true),
  ('ES', 'Spain', 'international', true),
  ('LK', 'Sri Lanka', 'international', true),
  ('SD', 'Sudan', 'international', true),
  ('SR', 'Suriname', 'international', true),
  ('SE', 'Sweden', 'international', true),
  ('CH', 'Switzerland', 'international', true),
  ('TW', 'Taiwan', 'international', true),
  ('TJ', 'Tajikistan', 'international', true),
  ('TZ', 'Tanzania', 'international', true),
  ('TH', 'Thailand', 'international', true),
  ('TL', 'Timor-Leste', 'international', true),
  ('TG', 'Togo', 'international', true),
  ('TO', 'Tonga', 'international', true),
  ('TT', 'Trinidad and Tobago', 'international', true),
  ('TN', 'Tunisia', 'international', true),
  ('TR', 'Türkiye', 'international', true),
  ('TM', 'Turkmenistan', 'international', true),
  ('TV', 'Tuvalu', 'international', true),
  ('UG', 'Uganda', 'international', true),
  ('UA', 'Ukraine', 'international', true),
  ('UY', 'Uruguay', 'international', true),
  ('UZ', 'Uzbekistan', 'international', true),
  ('VU', 'Vanuatu', 'international', true),
  ('VA', 'Vatican City', 'international', true),
  ('VE', 'Venezuela', 'international', true),
  ('VN', 'Vietnam', 'international', true),
  ('YE', 'Yemen', 'international', true),
  ('ZM', 'Zambia', 'international', true),
  ('ZW', 'Zimbabwe', 'international', true)
on conflict (code) do nothing;

insert into public.shipping_zones (id, market_id, name)
values ('international', 'international', 'International')
on conflict (id) do nothing;

insert into public.shipping_zone_countries (country_code, zone_id, market_id)
values
  ('AF', 'international', 'international'),
  ('AL', 'international', 'international'),
  ('DZ', 'international', 'international'),
  ('AD', 'international', 'international'),
  ('AO', 'international', 'international'),
  ('AG', 'international', 'international'),
  ('AR', 'international', 'international'),
  ('AM', 'international', 'international'),
  ('AU', 'international', 'international'),
  ('AT', 'international', 'international'),
  ('AZ', 'international', 'international'),
  ('BS', 'international', 'international'),
  ('BH', 'international', 'international'),
  ('BD', 'international', 'international'),
  ('BB', 'international', 'international'),
  ('BY', 'international', 'international'),
  ('BE', 'international', 'international'),
  ('BZ', 'international', 'international'),
  ('BJ', 'international', 'international'),
  ('BT', 'international', 'international'),
  ('BO', 'international', 'international'),
  ('BA', 'international', 'international'),
  ('BW', 'international', 'international'),
  ('BR', 'international', 'international'),
  ('BN', 'international', 'international'),
  ('BG', 'international', 'international'),
  ('BF', 'international', 'international'),
  ('BI', 'international', 'international'),
  ('KH', 'international', 'international'),
  ('CM', 'international', 'international'),
  ('CA', 'international', 'international'),
  ('CV', 'international', 'international'),
  ('CF', 'international', 'international'),
  ('TD', 'international', 'international'),
  ('CL', 'international', 'international'),
  ('CN', 'international', 'international'),
  ('CO', 'international', 'international'),
  ('KM', 'international', 'international'),
  ('CG', 'international', 'international'),
  ('CR', 'international', 'international'),
  ('CI', 'international', 'international'),
  ('HR', 'international', 'international'),
  ('CU', 'international', 'international'),
  ('CY', 'international', 'international'),
  ('CZ', 'international', 'international'),
  ('DK', 'international', 'international'),
  ('DJ', 'international', 'international'),
  ('DM', 'international', 'international'),
  ('DO', 'international', 'international'),
  ('EC', 'international', 'international'),
  ('EG', 'international', 'international'),
  ('SV', 'international', 'international'),
  ('GQ', 'international', 'international'),
  ('ER', 'international', 'international'),
  ('EE', 'international', 'international'),
  ('SZ', 'international', 'international'),
  ('ET', 'international', 'international'),
  ('FJ', 'international', 'international'),
  ('FI', 'international', 'international'),
  ('GA', 'international', 'international'),
  ('GM', 'international', 'international'),
  ('GE', 'international', 'international'),
  ('GH', 'international', 'international'),
  ('GR', 'international', 'international'),
  ('GD', 'international', 'international'),
  ('GT', 'international', 'international'),
  ('GN', 'international', 'international'),
  ('GW', 'international', 'international'),
  ('GY', 'international', 'international'),
  ('HT', 'international', 'international'),
  ('HN', 'international', 'international'),
  ('HK', 'international', 'international'),
  ('HU', 'international', 'international'),
  ('IS', 'international', 'international'),
  ('ID', 'international', 'international'),
  ('IR', 'international', 'international'),
  ('IQ', 'international', 'international'),
  ('IE', 'international', 'international'),
  ('IL', 'international', 'international'),
  ('IT', 'international', 'international'),
  ('JM', 'international', 'international'),
  ('JP', 'international', 'international'),
  ('JO', 'international', 'international'),
  ('KZ', 'international', 'international'),
  ('KE', 'international', 'international'),
  ('KI', 'international', 'international'),
  ('KW', 'international', 'international'),
  ('KG', 'international', 'international'),
  ('LA', 'international', 'international'),
  ('LV', 'international', 'international'),
  ('LB', 'international', 'international'),
  ('LS', 'international', 'international'),
  ('LR', 'international', 'international'),
  ('LY', 'international', 'international'),
  ('LI', 'international', 'international'),
  ('LT', 'international', 'international'),
  ('LU', 'international', 'international'),
  ('MO', 'international', 'international'),
  ('MG', 'international', 'international'),
  ('MW', 'international', 'international'),
  ('MY', 'international', 'international'),
  ('MV', 'international', 'international'),
  ('ML', 'international', 'international'),
  ('MT', 'international', 'international'),
  ('MH', 'international', 'international'),
  ('MR', 'international', 'international'),
  ('MU', 'international', 'international'),
  ('MX', 'international', 'international'),
  ('FM', 'international', 'international'),
  ('MD', 'international', 'international'),
  ('MC', 'international', 'international'),
  ('MN', 'international', 'international'),
  ('ME', 'international', 'international'),
  ('MA', 'international', 'international'),
  ('MZ', 'international', 'international'),
  ('MM', 'international', 'international'),
  ('NA', 'international', 'international'),
  ('NR', 'international', 'international'),
  ('NP', 'international', 'international'),
  ('NL', 'international', 'international'),
  ('NZ', 'international', 'international'),
  ('NI', 'international', 'international'),
  ('NE', 'international', 'international'),
  ('NG', 'international', 'international'),
  ('MK', 'international', 'international'),
  ('NO', 'international', 'international'),
  ('OM', 'international', 'international'),
  ('PK', 'international', 'international'),
  ('PW', 'international', 'international'),
  ('PA', 'international', 'international'),
  ('PG', 'international', 'international'),
  ('PY', 'international', 'international'),
  ('PE', 'international', 'international'),
  ('PH', 'international', 'international'),
  ('PL', 'international', 'international'),
  ('PT', 'international', 'international'),
  ('QA', 'international', 'international'),
  ('RO', 'international', 'international'),
  ('RW', 'international', 'international'),
  ('KN', 'international', 'international'),
  ('LC', 'international', 'international'),
  ('VC', 'international', 'international'),
  ('WS', 'international', 'international'),
  ('SM', 'international', 'international'),
  ('ST', 'international', 'international'),
  ('SN', 'international', 'international'),
  ('RS', 'international', 'international'),
  ('SC', 'international', 'international'),
  ('SL', 'international', 'international'),
  ('SG', 'international', 'international'),
  ('SK', 'international', 'international'),
  ('SI', 'international', 'international'),
  ('SB', 'international', 'international'),
  ('SO', 'international', 'international'),
  ('ZA', 'international', 'international'),
  ('KR', 'international', 'international'),
  ('SS', 'international', 'international'),
  ('ES', 'international', 'international'),
  ('LK', 'international', 'international'),
  ('SD', 'international', 'international'),
  ('SR', 'international', 'international'),
  ('SE', 'international', 'international'),
  ('CH', 'international', 'international'),
  ('TW', 'international', 'international'),
  ('TJ', 'international', 'international'),
  ('TZ', 'international', 'international'),
  ('TH', 'international', 'international'),
  ('TL', 'international', 'international'),
  ('TG', 'international', 'international'),
  ('TO', 'international', 'international'),
  ('TT', 'international', 'international'),
  ('TN', 'international', 'international'),
  ('TR', 'international', 'international'),
  ('TM', 'international', 'international'),
  ('TV', 'international', 'international'),
  ('UG', 'international', 'international'),
  ('UA', 'international', 'international'),
  ('UY', 'international', 'international'),
  ('UZ', 'international', 'international'),
  ('VU', 'international', 'international'),
  ('VA', 'international', 'international'),
  ('VE', 'international', 'international'),
  ('VN', 'international', 'international'),
  ('YE', 'international', 'international'),
  ('ZM', 'international', 'international'),
  ('ZW', 'international', 'international')
on conflict (country_code) do nothing;

insert into public.shipping_methods (id, zone_id, code, label, estimated_delivery, is_active)
values
  ('europe-standard', 'europe', 'standard', 'Standard Delivery', '2+ weeks', true),
  ('usa-standard', 'usa', 'standard', 'Standard Delivery', '2+ weeks', true),
  ('gcc-standard', 'gcc', 'standard', 'Standard Delivery', '2+ weeks', true),
  ('india-standard', 'india', 'standard', 'Standard Delivery', '2+ weeks', true),
  ('international-standard', 'international', 'standard', 'Standard Delivery', '2+ weeks', true)
on conflict (id) do nothing;

insert into public.shipping_rates (method_id, currency_code, amount_minor)
values
  ('europe-standard', 'GBP', 465),
  ('usa-standard', 'GBP', 465),
  ('gcc-standard', 'GBP', 465),
  ('india-standard', 'GBP', 465),
  ('international-standard', 'GBP', 465)
on conflict (method_id, currency_code) do nothing;

alter table public.payments drop constraint if exists payments_currency_v1;

alter table public.payments
  add constraint payments_currency_v1
  check (
    currency = 'GBP'
    or (
      currency in ('EUR', 'USD')
      and provider = 'paypal'
      and fx_rate_id is not null
      and btrim(fx_rate_id) <> ''
      and quote_frozen_at is not null
    )
    or (
      currency = 'INR'
      and provider = 'razorpay'
      and fx_rate_id is not null
      and btrim(fx_rate_id) <> ''
      and quote_frozen_at is not null
    )
  );

alter table public.order_charge_snapshots drop constraint if exists order_charge_snapshots_provider_currency;

alter table public.order_charge_snapshots
  add constraint order_charge_snapshots_provider_currency
  check (
    (
      payment_provider = 'paypal'
      and charge_currency = 'GBP'
      and charge_total_minor = order_total_minor
    )
    or (
      payment_provider = 'paypal'
      and charge_currency in ('EUR', 'USD')
      and fx_rate_id is not null
      and btrim(fx_rate_id) <> ''
      and fx_rate is not null
      and btrim(fx_rate) <> ''
      and fx_version is not null
      and fx_version > 0
      and quote_frozen_at is not null
    )
    or (
      payment_provider = 'razorpay'
      and charge_currency = 'INR'
      and fx_rate_id is not null
      and btrim(fx_rate_id) <> ''
      and fx_rate is not null
      and btrim(fx_rate) <> ''
      and fx_version is not null
      and fx_version > 0
      and quote_frozen_at is not null
    )
  );

create or replace function private.insert_order_charge_snapshot(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_country text;
  v_lines jsonb;
  v_charge_subtotal integer;
  v_charge_shipping integer;
begin
  if exists (
    select 1 from public.order_charge_snapshots where payment_id = p_payment_id
  ) then
    return;
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'snapshot payment is missing';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id;
  if not found or v_order.currency is distinct from 'GBP' then
    raise exception 'snapshot order is not a GBP order';
  end if;

  v_country := upper(btrim(coalesce(v_order.delivery_address->>'country', '')));
  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'snapshot destination country is missing';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sku', item.sku,
        'product_name', item.product_name,
        'colour_name', item.colour_name,
        'variant_name', item.variant_name,
        'quantity', item.quantity,
        'unit_price_minor', item.unit_price_minor,
        'line_total_minor', item.line_total_minor
      )
      order by item.created_at
    ),
    '[]'::jsonb
  )
  into v_lines
  from public.order_items item
  where item.order_id = v_order.id;

  if v_payment.currency = 'GBP' then
    v_charge_subtotal := v_order.subtotal_minor;
    v_charge_shipping := v_order.shipping_minor;
  elsif v_payment.charge_subtotal_minor is null or v_payment.charge_shipping_minor is null then
    raise exception 'snapshot charge parts are missing';
  else
    v_charge_subtotal := v_payment.charge_subtotal_minor;
    v_charge_shipping := v_payment.charge_shipping_minor;
  end if;

  insert into public.order_charge_snapshots (
    order_id,
    payment_id,
    destination_country,
    order_currency,
    subtotal_minor,
    shipping_minor,
    tax_minor,
    discount_minor,
    order_total_minor,
    payment_provider,
    charge_currency,
    charge_subtotal_minor,
    charge_shipping_minor,
    charge_total_minor,
    shipping_method_id,
    shipping_label,
    estimated_delivery,
    delivery_address,
    fx_rate_id,
    fx_version,
    fx_rate,
    quote_frozen_at,
    lines
  ) values (
    v_order.id,
    v_payment.id,
    v_country,
    'GBP',
    v_order.subtotal_minor,
    v_order.shipping_minor,
    0,
    0,
    v_order.total_minor,
    v_payment.provider,
    v_payment.currency,
    v_charge_subtotal,
    v_charge_shipping,
    v_payment.amount_minor,
    nullif(btrim(coalesce(v_payment.shipping_method_id, '')), ''),
    nullif(btrim(coalesce(v_payment.shipping_label, '')), ''),
    nullif(btrim(coalesce(v_payment.estimated_delivery, '')), ''),
    v_order.delivery_address,
    nullif(btrim(coalesce(v_payment.fx_rate_id, '')), ''),
    v_payment.fx_version,
    nullif(btrim(coalesce(v_payment.fx_rate, '')), ''),
    v_payment.quote_frozen_at,
    v_lines
  );
end;
$$;

revoke all on function private.insert_order_charge_snapshot(uuid) from public, anon, authenticated;

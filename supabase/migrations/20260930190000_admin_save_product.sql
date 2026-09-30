begin;

-- Product Editor integrity.
-- One transaction for catalogue text, variants, collections, and image metadata.
-- Does not rewrite historical SKUs or wipe the catalogue.
-- Does not touch payments, checkout, shipping, or email.

alter table public.products
  add column if not exists product_code text;

alter table public.products
  drop constraint if exists products_product_code_format;

alter table public.products
  add constraint products_product_code_format
  check (
    product_code is null
    or (
      char_length(product_code) between 1 and 12
      and product_code = upper(product_code)
      and product_code ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'
    )
  );

create unique index if not exists products_product_code_key
  on public.products (product_code);

comment on column public.products.product_code is
  'Short stable SKU prefix, separate from the URL slug. Setting it does not rewrite existing variant SKUs.';

create sequence if not exists private.product_code_seq;

revoke all on sequence private.product_code_seq from public, anon, authenticated;

-- Sort order plus the single product-level primary. Variant-scoped primaries stay.
create or replace function private.admin_assign_product_image_order(
  p_product_id uuid,
  p_order uuid[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_sort integer := 0;
  v_seen uuid[] := array[]::uuid[];
  v_primary uuid;
  v_variant uuid;
  v_ordered uuid[] := coalesce(p_order, array[]::uuid[]);
begin
  foreach v_id in array v_ordered loop
    if v_id is null or v_id = any(v_seen) then
      continue;
    end if;
    update public.product_images
    set sort_order = v_sort,
        updated_at = pg_catalog.now()
    where id = v_id
      and product_id = p_product_id;
    if found then
      v_seen := v_seen || v_id;
      v_sort := v_sort + 1;
    end if;
  end loop;

  for v_id in
    select id
    from public.product_images
    where product_id = p_product_id
      and not (id = any(v_seen))
    order by sort_order, created_at
  loop
    update public.product_images
    set sort_order = v_sort,
        updated_at = pg_catalog.now()
    where id = v_id;
    v_seen := v_seen || v_id;
    v_sort := v_sort + 1;
  end loop;

  v_primary := null;
  if coalesce(array_length(v_seen, 1), 0) > 0 then
    foreach v_id in array v_seen loop
      select variant_id
        into v_variant
      from public.product_images
      where id = v_id
        and product_id = p_product_id;
      if v_variant is null then
        v_primary := v_id;
        exit;
      end if;
    end loop;
  end if;

  update public.product_images
  set image_type = 'secondary'::public.product_image_type,
      updated_at = pg_catalog.now()
  where product_id = p_product_id
    and variant_id is null
    and image_type = 'primary'::public.product_image_type
    and (v_primary is null or id is distinct from v_primary);

  if v_primary is not null then
    update public.product_images
    set image_type = 'primary'::public.product_image_type,
        updated_at = pg_catalog.now()
    where id = v_primary
      and product_id = p_product_id
      and variant_id is null;
  end if;
end;
$$;

revoke all on function private.admin_assign_product_image_order(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.admin_save_product(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_product_id uuid;
  v_expected timestamptz;
  v_status public.catalogue_status;
  v_updated timestamptz;
  v_name text;
  v_slug text;
  v_code text;
  v_requested_code text;
  v_seq bigint;
  v_attempts integer := 0;
  v_item jsonb;
  v_key text;
  v_sku text;
  v_colour text;
  v_size text;
  v_existing_id uuid;
  v_new_id uuid;
  v_existing uuid[] := array[]::uuid[];
  v_keep uuid[] := array[]::uuid[];
  v_remove uuid[] := array[]::uuid[];
  v_map jsonb := '{}'::jsonb;
  v_price integer;
  v_compare integer;
  v_stock integer;
  v_variant_status public.variant_status;
  v_image jsonb;
  v_image_id uuid;
  v_variant_key text;
  v_resolved_text text;
  v_resolved uuid;
  v_current_type public.product_image_type;
  v_next_type public.product_image_type;
  v_collection uuid;
  v_order uuid[] := array[]::uuid[];
  v_order_text text;
begin
  if not private.is_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  v_name := btrim(coalesce(payload->>'name', ''));
  if v_name = '' or char_length(v_name) > 120 then
    return jsonb_build_object('status', 'invalid', 'field', 'name', 'code', 'variant_invalid', 'rolledBack', true);
  end if;

  if coalesce(payload->>'disclosure', '') = '' or char_length(btrim(payload->>'disclosure')) > 120 then
    return jsonb_build_object('status', 'invalid', 'field', 'disclosure', 'code', 'variant_invalid', 'rolledBack', true);
  end if;

  v_requested_code := upper(btrim(coalesce(payload->>'productCode', '')));
  if v_requested_code <> '' and (
    char_length(v_requested_code) > 12
    or v_requested_code !~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'
  ) then
    return jsonb_build_object('status', 'invalid', 'field', 'productCode', 'code', 'product_code_invalid', 'rolledBack', true);
  end if;

  if nullif(btrim(coalesce(payload->>'id', '')), '') is not null then
    if btrim(payload->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('status', 'not_found');
    end if;
    v_id := (payload->>'id')::uuid;
  end if;

  if nullif(btrim(coalesce(payload->>'updatedAt', '')), '') is not null then
    begin
      v_expected := (payload->>'updatedAt')::timestamptz;
    exception
      when others then
        return jsonb_build_object('status', 'stale');
    end;
  end if;

  if v_requested_code <> '' then
    v_code := v_requested_code;
  else
    loop
      v_attempts := v_attempts + 1;
      if v_attempts > 20 then
        return jsonb_build_object('status', 'error', 'rolledBack', true);
      end if;
      v_seq := pg_catalog.nextval('private.product_code_seq');
      v_code := 'SHD-' || lpad(v_seq::text, 5, '0');
      exit when char_length(v_code) <= 12
        and not exists (
          select 1 from public.products where product_code = v_code and id is distinct from v_id
        );
    end loop;
  end if;

  if v_id is null then
    v_slug := btrim(coalesce(payload->>'allocatedSlug', ''));
    if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
      return jsonb_build_object('status', 'invalid', 'field', 'slug', 'code', 'slug_taken', 'rolledBack', true);
    end if;
    insert into public.products (
      slug,
      name,
      brand,
      description,
      materials,
      whats_included,
      gender,
      shape,
      fit,
      disclosure,
      status,
      product_code,
      updated_at
    ) values (
      v_slug,
      v_name,
      nullif(btrim(coalesce(payload->>'brand', '')), ''),
      nullif(btrim(coalesce(payload->>'description', '')), ''),
      nullif(btrim(coalesce(payload->>'materials', '')), ''),
      nullif(btrim(coalesce(payload->>'whatsIncluded', '')), ''),
      nullif(btrim(coalesce(payload->>'gender', '')), ''),
      nullif(btrim(coalesce(payload->>'shape', '')), ''),
      nullif(btrim(coalesce(payload->>'fit', '')), ''),
      btrim(payload->>'disclosure'),
      'draft'::public.catalogue_status,
      v_code,
      pg_catalog.now()
    )
    returning id, updated_at into v_product_id, v_updated;
  else
    select status, updated_at
      into v_status, v_updated
    from public.products
    where id = v_id
    for update;

    if not found then
      return jsonb_build_object('status', 'not_found');
    end if;

    if v_expected is not null and v_updated is distinct from v_expected then
      return jsonb_build_object('status', 'stale');
    end if;

    if v_status = 'archived'::public.catalogue_status and not private.is_superadmin() then
      return jsonb_build_object('status', 'forbidden');
    end if;

    update public.products
    set name = v_name,
        brand = nullif(btrim(coalesce(payload->>'brand', '')), ''),
        description = nullif(btrim(coalesce(payload->>'description', '')), ''),
        materials = nullif(btrim(coalesce(payload->>'materials', '')), ''),
        whats_included = nullif(btrim(coalesce(payload->>'whatsIncluded', '')), ''),
        gender = nullif(btrim(coalesce(payload->>'gender', '')), ''),
        shape = nullif(btrim(coalesce(payload->>'shape', '')), ''),
        fit = nullif(btrim(coalesce(payload->>'fit', '')), ''),
        disclosure = btrim(payload->>'disclosure'),
        product_code = v_code,
        updated_at = pg_catalog.now()
    where id = v_id
    returning updated_at into v_updated;

    v_product_id := v_id;
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
    into v_existing
  from public.product_variants
  where product_id = v_product_id;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(payload->'variants', '[]'::jsonb))
  loop
    v_key := btrim(coalesce(v_item->>'clientKey', ''));
    v_sku := btrim(coalesce(v_item->>'sku', ''));
    v_colour := btrim(coalesce(v_item->>'colourName', ''));
    v_size := nullif(btrim(coalesce(v_item->>'sizeName', '')), '');
    if v_key = '' or v_sku = '' or char_length(v_sku) > 64 or v_colour = '' or char_length(v_colour) > 120 then
      raise exception 'variant_invalid';
    end if;
    if v_size is not null and char_length(v_size) > 120 then
      raise exception 'variant_invalid';
    end if;

    v_price := (v_item->>'priceMinor')::integer;
    if v_item->>'compareAtMinor' is null or btrim(v_item->>'compareAtMinor') = '' or v_item->>'compareAtMinor' = 'null' then
      v_compare := null;
    else
      v_compare := (v_item->>'compareAtMinor')::integer;
    end if;
    v_stock := coalesce((v_item->>'stockQuantity')::integer, 0);
    if v_price < 0 or v_stock < 0 or (v_compare is not null and v_compare < v_price) then
      raise exception 'variant_invalid';
    end if;

    if coalesce(v_item->>'status', '') in ('draft', 'available', 'unavailable', 'archived') then
      v_variant_status := (v_item->>'status')::public.variant_status;
    else
      v_variant_status := 'available'::public.variant_status;
    end if;

    v_existing_id := null;
    if coalesce(v_item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_existing_id := (v_item->>'id')::uuid;
    end if;

    if v_existing_id is not null and v_existing_id = any(v_existing) then
      update public.product_variants
      set sku = v_sku,
          colour_name = v_colour,
          size_name = v_size,
          price_minor = v_price,
          compare_at_price_minor = v_compare,
          currency = 'GBP',
          stock_quantity = v_stock,
          status = v_variant_status,
          lens_width_mm = nullif(v_item->>'lensWidthMm', '')::integer,
          bridge_width_mm = nullif(v_item->>'bridgeWidthMm', '')::integer,
          temple_length_mm = nullif(v_item->>'templeLengthMm', '')::integer,
          updated_at = pg_catalog.now()
      where id = v_existing_id
        and product_id = v_product_id;
      v_keep := v_keep || v_existing_id;
      v_map := v_map || jsonb_build_object(v_key, v_existing_id::text);
      v_map := v_map || jsonb_build_object(v_existing_id::text, v_existing_id::text);
    else
      insert into public.product_variants (
        product_id,
        sku,
        colour_name,
        size_name,
        price_minor,
        compare_at_price_minor,
        currency,
        stock_quantity,
        status,
        lens_width_mm,
        bridge_width_mm,
        temple_length_mm,
        updated_at
      ) values (
        v_product_id,
        v_sku,
        v_colour,
        v_size,
        v_price,
        v_compare,
        'GBP',
        v_stock,
        v_variant_status,
        nullif(v_item->>'lensWidthMm', '')::integer,
        nullif(v_item->>'bridgeWidthMm', '')::integer,
        nullif(v_item->>'templeLengthMm', '')::integer,
        pg_catalog.now()
      )
      returning id into v_new_id;
      v_keep := v_keep || v_new_id;
      v_map := v_map || jsonb_build_object(v_key, v_new_id::text);
      v_map := v_map || jsonb_build_object(v_new_id::text, v_new_id::text);
    end if;
  end loop;

  select coalesce(array_agg(id), array[]::uuid[])
    into v_remove
  from public.product_variants
  where product_id = v_product_id
    and not (id = any(v_keep));

  for v_image in
    select value
    from jsonb_array_elements(coalesce(payload->'images', '[]'::jsonb))
  loop
    if coalesce(v_image->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      continue;
    end if;
    v_image_id := (v_image->>'id')::uuid;
    if not exists (
      select 1 from public.product_images
      where id = v_image_id and product_id = v_product_id
    ) then
      continue;
    end if;

    if coalesce((v_image->>'variantKeyPresent')::boolean, false) then
      v_variant_key := btrim(coalesce(v_image->>'variantKey', ''));
      if v_variant_key = '' then
        v_resolved := null;
      else
        v_resolved_text := v_map->>v_variant_key;
        if v_resolved_text is null
          and v_variant_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and (v_variant_key::uuid = any(v_keep)) then
          v_resolved_text := v_variant_key;
        end if;
        if v_resolved_text is null or not (v_resolved_text::uuid = any(v_keep)) then
          raise exception 'image_variant_missing';
        end if;
        v_resolved := v_resolved_text::uuid;
      end if;

      select image_type
        into v_current_type
      from public.product_images
      where id = v_image_id
        and product_id = v_product_id;

      if v_resolved is not null and v_current_type = 'primary'::public.product_image_type and exists (
        select 1
        from public.product_images
        where product_id = v_product_id
          and variant_id = v_resolved
          and image_type = 'primary'::public.product_image_type
          and id <> v_image_id
      ) then
        v_next_type := 'secondary'::public.product_image_type;
      elsif v_resolved is null and v_current_type = 'primary'::public.product_image_type then
        v_next_type := 'secondary'::public.product_image_type;
      else
        v_next_type := v_current_type;
      end if;

      update public.product_images
      set alt_text = case
            when coalesce((v_image->>'altPresent')::boolean, false)
              then coalesce(nullif(btrim(coalesce(v_image->>'alt', '')), ''), alt_text, 'Product image')
            else alt_text
          end,
          variant_id = v_resolved,
          image_type = v_next_type,
          updated_at = pg_catalog.now()
      where id = v_image_id
        and product_id = v_product_id;
    elsif coalesce((v_image->>'altPresent')::boolean, false) then
      update public.product_images
      set alt_text = coalesce(nullif(btrim(coalesce(v_image->>'alt', '')), ''), alt_text, 'Product image'),
          updated_at = pg_catalog.now()
      where id = v_image_id
        and product_id = v_product_id;
    end if;
  end loop;

  update public.product_images as image
  set variant_id = null,
      image_type = case
        when image.image_type = 'primary'::public.product_image_type
          then 'secondary'::public.product_image_type
        else image.image_type
      end,
      updated_at = pg_catalog.now()
  where image.product_id = v_product_id
    and image.variant_id = any(v_remove)
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(payload->'images', '[]'::jsonb)) elem
      where elem->>'id' = image.id::text
        and coalesce((elem->>'variantKeyPresent')::boolean, false)
    );

  if exists (
    select 1
    from public.product_images
    where product_id = v_product_id
      and variant_id = any(v_remove)
  ) then
    raise exception 'image_variant_missing';
  end if;

  if coalesce(array_length(v_remove, 1), 0) > 0 then
    if exists (
      select 1 from public.cart_items where product_variant_id = any(v_remove)
    ) or exists (
      select 1 from public.order_items where product_variant_id = any(v_remove)
    ) then
      raise exception 'variant_referenced';
    end if;

    delete from public.product_variants
    where product_id = v_product_id
      and id = any(v_remove);
  end if;

  delete from public.product_collections
  where product_id = v_product_id;

  for v_order_text in
    select value
    from jsonb_array_elements_text(coalesce(payload->'collectionIds', '[]'::jsonb))
  loop
    if v_order_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_collection := v_order_text::uuid;
      if exists (select 1 from public.collections where id = v_collection) then
        insert into public.product_collections (product_id, collection_id)
        values (v_product_id, v_collection)
        on conflict do nothing;
      end if;
    end if;
  end loop;

  for v_order_text in
    select value
    from jsonb_array_elements_text(coalesce(payload->'imageOrder', '[]'::jsonb))
  loop
    if v_order_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_order := v_order || v_order_text::uuid;
    end if;
  end loop;

  perform private.admin_assign_product_image_order(v_product_id, v_order);

  return jsonb_build_object(
    'status', 'ok',
    'productId', v_product_id,
    'updatedAt', v_updated,
    'productCode', v_code,
    'variants', v_map
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'status', 'invalid',
      'rolledBack', true,
      'field', case
        when sqlerrm ilike '%product_code%' then 'productCode'
        when sqlerrm ilike '%product_variants_sku%' then 'sku'
        when sqlerrm ilike '%slug%' then 'slug'
        else 'variants'
      end,
      'code', case
        when sqlerrm ilike '%product_code%' then 'product_code_taken'
        when sqlerrm ilike '%product_variants_sku%' then 'sku_taken'
        when sqlerrm ilike '%slug%' then 'slug_taken'
        else 'sku_options'
      end
    );
  when foreign_key_violation then
    return jsonb_build_object(
      'status', 'invalid',
      'rolledBack', true,
      'field', 'variants',
      'code', 'variant_referenced'
    );
  when check_violation or data_exception then
    return jsonb_build_object(
      'status', 'invalid',
      'rolledBack', true,
      'field', 'variants',
      'code', 'variant_invalid'
    );
  when others then
    if sqlerrm = 'image_variant_missing' then
      return jsonb_build_object(
        'status', 'invalid',
        'rolledBack', true,
        'field', 'images',
        'code', 'image_variant'
      );
    elsif sqlerrm = 'variant_referenced' then
      return jsonb_build_object(
        'status', 'invalid',
        'rolledBack', true,
        'field', 'variants',
        'code', 'variant_referenced'
      );
    elsif sqlerrm = 'variant_invalid' then
      return jsonb_build_object(
        'status', 'invalid',
        'rolledBack', true,
        'field', 'variants',
        'code', 'variant_invalid'
      );
    end if;
    return jsonb_build_object('status', 'error', 'rolledBack', true);
end;
$$;

create or replace function public.admin_publish_product(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.catalogue_status;
  v_name text;
  v_slug text;
  v_disclosure text;
  v_updated timestamptz;
  v_published timestamptz;
begin
  if not private.is_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select status, name, slug, disclosure
    into v_status, v_name, v_slug, v_disclosure
  from public.products
  where id = p_product_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_status = 'archived'::public.catalogue_status and not private.is_superadmin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if btrim(coalesce(v_name, '')) = ''
    or btrim(coalesce(v_slug, '')) = ''
    or btrim(coalesce(v_disclosure, '')) = '' then
    return jsonb_build_object('status', 'invalid', 'field', 'name', 'code', 'publish_incomplete');
  end if;

  if not exists (
    select 1
    from public.product_variants
    where product_id = p_product_id
      and btrim(sku) <> ''
      and btrim(colour_name) <> ''
      and price_minor >= 0
      and status = 'available'::public.variant_status
  ) then
    return jsonb_build_object('status', 'invalid', 'field', 'variants', 'code', 'publish_variants');
  end if;

  if not exists (
    select 1 from public.product_images where product_id = p_product_id
  ) then
    return jsonb_build_object('status', 'invalid', 'field', 'images', 'code', 'publish_images');
  end if;

  update public.products
  set status = 'published'::public.catalogue_status,
      updated_at = pg_catalog.now()
  where id = p_product_id
  returning updated_at, published_at into v_updated, v_published;

  return jsonb_build_object(
    'status', 'ok',
    'productId', p_product_id,
    'updatedAt', v_updated,
    'publishedAt', v_published
  );
end;
$$;

create or replace function public.admin_unpublish_product(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.catalogue_status;
  v_updated timestamptz;
begin
  if not private.is_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select status
    into v_status
  from public.products
  where id = p_product_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_status = 'archived'::public.catalogue_status then
    return jsonb_build_object('status', 'forbidden');
  end if;

  update public.products
  set status = 'draft'::public.catalogue_status,
      updated_at = pg_catalog.now()
  where id = p_product_id
    and status = 'published'::public.catalogue_status
  returning updated_at into v_updated;

  if v_updated is null then
    select updated_at into v_updated from public.products where id = p_product_id;
  end if;

  return jsonb_build_object('status', 'ok', 'productId', p_product_id, 'updatedAt', v_updated);
end;
$$;

create or replace function public.admin_reorder_product_images(
  p_product_id uuid,
  p_image_order uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform private.admin_assign_product_image_order(p_product_id, p_image_order);
  return jsonb_build_object('status', 'ok', 'productId', p_product_id);
exception
  when others then
    return jsonb_build_object('status', 'error', 'rolledBack', true);
end;
$$;

revoke all on function public.admin_save_product(jsonb) from public, anon;
revoke all on function public.admin_publish_product(uuid) from public, anon;
revoke all on function public.admin_unpublish_product(uuid) from public, anon;
revoke all on function public.admin_reorder_product_images(uuid, uuid[]) from public, anon;

grant execute on function public.admin_save_product(jsonb) to authenticated;
grant execute on function public.admin_publish_product(uuid) to authenticated;
grant execute on function public.admin_unpublish_product(uuid) to authenticated;
grant execute on function public.admin_reorder_product_images(uuid, uuid[]) to authenticated;

comment on function public.admin_save_product(jsonb) is
  'Atomic admin catalogue save. Draft status is unchanged. Does not publish.';

comment on function public.admin_publish_product(uuid) is
  'Publishes one product after checking the saved row, variants, and images in the same transaction.';

commit;

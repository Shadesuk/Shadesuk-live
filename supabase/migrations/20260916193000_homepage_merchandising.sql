begin;

-- First successful publication timestamp. Never overwritten once set.
alter table public.products
  add column if not exists published_at timestamptz;

update public.products
set published_at = coalesce(published_at, created_at)
where status = 'published'::public.catalogue_status
  and published_at is null;

create or replace function private.products_set_published_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.published_at is not null then
    new.published_at := old.published_at;
    return new;
  end if;
  if new.status = 'published'::public.catalogue_status and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists products_set_published_at on public.products;
create trigger products_set_published_at
before insert or update of status, published_at on public.products
for each row
execute function private.products_set_published_at();

-- Singleton homepage merchandising controls. Not a CMS.
create table if not exists public.homepage_merchandising (
  id text primary key default 'homepage',
  featured_enabled boolean not null default false,
  best_sellers_enabled boolean not null default false,
  flagship_product_id uuid references public.products (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint homepage_merchandising_singleton check (id = 'homepage')
);

create table if not exists public.homepage_featured_products (
  product_id uuid primary key references public.products (id) on delete cascade,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint homepage_featured_sort_order_nonnegative check (sort_order >= 0)
);

create table if not exists public.homepage_best_seller_products (
  product_id uuid primary key references public.products (id) on delete cascade,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint homepage_best_seller_sort_order_nonnegative check (sort_order >= 0)
);

create index if not exists homepage_featured_products_sort_idx
  on public.homepage_featured_products (sort_order, product_id);

create index if not exists homepage_best_seller_products_sort_idx
  on public.homepage_best_seller_products (sort_order, product_id);

insert into public.homepage_merchandising (id)
values ('homepage')
on conflict (id) do nothing;

create or replace function private.merchandising_product_must_be_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_status public.catalogue_status;
begin
  if new.product_id is null then
    return new;
  end if;
  select status
    into product_status
  from public.products
  where id = new.product_id;
  if product_status is distinct from 'published'::public.catalogue_status then
    raise exception 'merchandising products must be published';
  end if;
  return new;
end;
$$;

create or replace function private.merchandising_flagship_must_be_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_status public.catalogue_status;
begin
  if new.flagship_product_id is null then
    return new;
  end if;
  select status
    into product_status
  from public.products
  where id = new.flagship_product_id;
  if product_status is distinct from 'published'::public.catalogue_status then
    raise exception 'merchandising products must be published';
  end if;
  return new;
end;
$$;

drop trigger if exists homepage_featured_must_be_published on public.homepage_featured_products;
create trigger homepage_featured_must_be_published
before insert or update of product_id on public.homepage_featured_products
for each row
execute function private.merchandising_product_must_be_published();

drop trigger if exists homepage_best_sellers_must_be_published on public.homepage_best_seller_products;
create trigger homepage_best_sellers_must_be_published
before insert or update of product_id on public.homepage_best_seller_products
for each row
execute function private.merchandising_product_must_be_published();

drop trigger if exists homepage_flagship_must_be_published on public.homepage_merchandising;
create trigger homepage_flagship_must_be_published
before insert or update of flagship_product_id on public.homepage_merchandising
for each row
execute function private.merchandising_flagship_must_be_published();

create or replace function private.products_clear_merchandising_when_unpublish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'published'::public.catalogue_status
     and new.status is distinct from 'published'::public.catalogue_status then
    delete from public.homepage_featured_products where product_id = new.id;
    delete from public.homepage_best_seller_products where product_id = new.id;
    update public.homepage_merchandising
      set flagship_product_id = null,
          updated_at = now()
      where flagship_product_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists products_clear_merchandising_when_unpublish on public.products;
create trigger products_clear_merchandising_when_unpublish
after update of status on public.products
for each row
execute function private.products_clear_merchandising_when_unpublish();

revoke all on function private.products_set_published_at() from public, anon, authenticated;
revoke all on function private.merchandising_product_must_be_published() from public, anon, authenticated;
revoke all on function private.merchandising_flagship_must_be_published() from public, anon, authenticated;
revoke all on function private.products_clear_merchandising_when_unpublish() from public, anon, authenticated;

alter table public.homepage_merchandising enable row level security;
alter table public.homepage_featured_products enable row level security;
alter table public.homepage_best_seller_products enable row level security;

grant select on table
  public.homepage_merchandising,
  public.homepage_featured_products,
  public.homepage_best_seller_products
to anon;

grant select, insert, update, delete on table
  public.homepage_merchandising,
  public.homepage_featured_products,
  public.homepage_best_seller_products
to authenticated;

grant all on table
  public.homepage_merchandising,
  public.homepage_featured_products,
  public.homepage_best_seller_products
to service_role;

-- Public may only see merchandising of published products.
create policy homepage_merchandising_public_read
on public.homepage_merchandising
for select
to anon, authenticated
using (true);

create policy homepage_featured_public_read
on public.homepage_featured_products
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = homepage_featured_products.product_id
      and products.status = 'published'::public.catalogue_status
  )
);

create policy homepage_best_sellers_public_read
on public.homepage_best_seller_products
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = homepage_best_seller_products.product_id
      and products.status = 'published'::public.catalogue_status
  )
);

-- Staff may read merchandising (product placement summary). Writes are Superadmin only.
create policy homepage_merchandising_admin_read
on public.homepage_merchandising
for select
to authenticated
using (private.is_admin());

create policy homepage_featured_admin_read
on public.homepage_featured_products
for select
to authenticated
using (private.is_admin());

create policy homepage_best_sellers_admin_read
on public.homepage_best_seller_products
for select
to authenticated
using (private.is_admin());

create policy homepage_merchandising_superadmin_insert
on public.homepage_merchandising
for insert
to authenticated
with check (private.is_superadmin());

create policy homepage_merchandising_superadmin_update
on public.homepage_merchandising
for update
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

create policy homepage_featured_superadmin_insert
on public.homepage_featured_products
for insert
to authenticated
with check (private.is_superadmin());

create policy homepage_featured_superadmin_update
on public.homepage_featured_products
for update
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

create policy homepage_featured_superadmin_delete
on public.homepage_featured_products
for delete
to authenticated
using (private.is_superadmin());

create policy homepage_best_sellers_superadmin_insert
on public.homepage_best_seller_products
for insert
to authenticated
with check (private.is_superadmin());

create policy homepage_best_sellers_superadmin_update
on public.homepage_best_seller_products
for update
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

create policy homepage_best_sellers_superadmin_delete
on public.homepage_best_seller_products
for delete
to authenticated
using (private.is_superadmin());

commit;

begin;

alter table public.product_images
  add column if not exists width integer;

alter table public.product_images
  add column if not exists height integer;

alter table public.product_images
  drop constraint if exists product_images_width_positive;

alter table public.product_images
  add constraint product_images_width_positive
  check (width is null or width > 0);

alter table public.product_images
  drop constraint if exists product_images_height_positive;

alter table public.product_images
  add constraint product_images_height_positive
  check (height is null or height > 0);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_storage_public_read on storage.objects;
create policy product_images_storage_public_read
on storage.objects
for select
to public
using (bucket_id = 'product-images');

drop policy if exists product_images_storage_admin_insert on storage.objects;
create policy product_images_storage_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and private.is_admin()
);

drop policy if exists product_images_storage_admin_update on storage.objects;
create policy product_images_storage_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and private.is_admin()
)
with check (
  bucket_id = 'product-images'
  and private.is_admin()
);

drop policy if exists product_images_storage_admin_delete on storage.objects;
create policy product_images_storage_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and private.is_admin()
);

commit;

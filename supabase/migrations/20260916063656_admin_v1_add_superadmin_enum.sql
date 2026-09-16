-- New enum labels must be committed before they are used in later statements
-- on some Postgres versions. Keep this file as a single ALTER TYPE.
alter type public.admin_role add value if not exists 'superadmin';

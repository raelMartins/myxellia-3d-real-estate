-- Soft-delete for units: avoid REST DELETE (which can hang on Supabase).
-- "Delete" = set deleted_at; list only units where deleted_at is null.
alter table public.units
  add column if not exists deleted_at timestamptz default null;

comment on column public.units.deleted_at is 'Set when unit is soft-deleted; list views filter to deleted_at is null';

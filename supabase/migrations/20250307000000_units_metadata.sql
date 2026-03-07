-- Unit metadata for admin-editable info clients see when reserving.
-- Admins add this data; clients only view and reserve.

alter table public.units
  add column if not exists display_name text,
  add column if not exists view_type text,
  add column if not exists amenities text,
  add column if not exists perks text,
  add column if not exists internal_model_url text;

comment on column public.units.display_name is 'Optional display name (e.g. "Skyline Penthouse")';
comment on column public.units.view_type is 'View description (e.g. City, Garden, Pool)';
comment on column public.units.amenities is 'Comma-separated or list of amenities';
comment on column public.units.perks is 'Perks or special offers text';
comment on column public.units.internal_model_url is 'URL for unit interior 3D model (admin only)';

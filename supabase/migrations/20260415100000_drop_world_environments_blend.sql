-- Remove .blend conversion columns (feature removed). Safe if columns never existed.
alter table public.world_environments drop column if exists blend_source_url;
alter table public.world_environments drop column if exists blend_conversion_status;

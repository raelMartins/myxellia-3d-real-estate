-- =============================================================================
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run
-- =============================================================================
-- 1. Add AI-generated environment image URL (for Pollinations skybox)
alter table public.buildings
  add column if not exists generated_env_url text;

comment on column public.buildings.generated_env_url is 'URL of AI-generated skybox image from env_context (Pollinations).';

-- 2. Ensure env_context exists (used by Deploy form and generate-env-image)
alter table public.buildings
  add column if not exists env_context text;

-- Optional: add other columns if your app uses them and they're missing
alter table public.buildings add column if not exists tagline text;
alter table public.buildings add column if not exists starting_price text;
alter table public.buildings add column if not exists hero_url text;
alter table public.buildings add column if not exists store_url text;

-- Add AI-generated environment image URL for skybox/backdrop
alter table public.buildings
  add column if not exists generated_env_url text;

comment on column public.buildings.generated_env_url is 'URL of AI-generated skybox image from env_context (Pollinations).';

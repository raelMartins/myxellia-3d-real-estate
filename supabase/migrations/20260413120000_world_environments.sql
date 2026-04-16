-- World environments: reusable ground/surroundings GLB + optional HDR sky (via skybox_environments).
-- Apply in Supabase SQL Editor or via CLI. Reuses public storage bucket `models/` for ground uploads (same as building models).

create table if not exists public.world_environments (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    label text not null,
    ground_model_url text not null,
    skybox_environment_id uuid references public.skybox_environments (id) on delete set null
);

create index if not exists world_environments_created_at_idx
    on public.world_environments (created_at desc);

alter table public.buildings
    add column if not exists world_environment_id uuid references public.world_environments (id) on delete set null;

create index if not exists buildings_world_environment_id_idx
    on public.buildings (world_environment_id);

alter table public.world_environments enable row level security;

-- Adjust policies to match your org (e.g. restrict to admin role via profiles).
create policy "world_environments_select_public"
    on public.world_environments for select
    using (true);

create policy "world_environments_insert_authenticated"
    on public.world_environments for insert to authenticated
    with check (true);

create policy "world_environments_update_authenticated"
    on public.world_environments for update to authenticated
    using (true)
    with check (true);

create policy "world_environments_delete_authenticated"
    on public.world_environments for delete to authenticated
    using (true);

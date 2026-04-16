-- Scatter props: small GLB/GLTF meshes instanced around the world ground model (see WorldScatterSurround).
-- Files use the same public `models/` storage bucket as ground models.

create table if not exists public.world_scatter_assets (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    world_environment_id uuid not null references public.world_environments (id) on delete cascade,
    label text not null,
    file_url text not null,
    kind text not null check (kind in ('clump', 'tree'))
);

create index if not exists world_scatter_assets_world_env_id_idx
    on public.world_scatter_assets (world_environment_id);

create index if not exists world_scatter_assets_created_at_idx
    on public.world_scatter_assets (created_at desc);

alter table public.world_environments
    add column if not exists active_surround_scatter_asset_id uuid references public.world_scatter_assets (id) on delete set null;

create index if not exists world_environments_active_scatter_idx
    on public.world_environments (active_surround_scatter_asset_id)
    where active_surround_scatter_asset_id is not null;

alter table public.world_scatter_assets enable row level security;

create policy "world_scatter_assets_select_public"
    on public.world_scatter_assets for select
    using (true);

create policy "world_scatter_assets_insert_authenticated"
    on public.world_scatter_assets for insert to authenticated
    with check (true);

create policy "world_scatter_assets_update_authenticated"
    on public.world_scatter_assets for update to authenticated
    using (true)
    with check (true);

create policy "world_scatter_assets_delete_authenticated"
    on public.world_scatter_assets for delete to authenticated
    using (true);

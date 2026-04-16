-- Global surround props (grass, rocks, trees, …) reused by worlds; engine picks asset + layout per world.

create table if not exists public.surround_catalog_assets (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    label text not null,
    file_url text not null
);

create index if not exists surround_catalog_assets_created_at_idx
    on public.surround_catalog_assets (created_at desc);

alter table public.world_environments
    add column if not exists active_surround_catalog_asset_id uuid references public.surround_catalog_assets (id) on delete set null;

alter table public.world_environments
    add column if not exists surround_layout_mode text
        check (surround_layout_mode is null or surround_layout_mode in ('packed', 'spread', 'sparse'));

create index if not exists world_environments_active_surround_catalog_idx
    on public.world_environments (active_surround_catalog_asset_id)
    where active_surround_catalog_asset_id is not null;

alter table public.surround_catalog_assets enable row level security;

create policy "surround_catalog_assets_select_public"
    on public.surround_catalog_assets for select
    using (true);

create policy "surround_catalog_assets_insert_authenticated"
    on public.surround_catalog_assets for insert to authenticated
    with check (true);

create policy "surround_catalog_assets_update_authenticated"
    on public.surround_catalog_assets for update to authenticated
    using (true)
    with check (true);

create policy "surround_catalog_assets_delete_authenticated"
    on public.surround_catalog_assets for delete to authenticated
    using (true);

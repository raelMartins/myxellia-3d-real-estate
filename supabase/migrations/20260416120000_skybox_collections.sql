-- Sky collections: multiple HDRIs per named collection (times of day / lighting slots).
-- world_environments.skybox_collection_id preferred over legacy skybox_environment_id.

create table if not exists public.skybox_collections (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    label text not null
);

create table if not exists public.skybox_collection_slots (
    id uuid primary key default gen_random_uuid(),
    collection_id uuid not null references public.skybox_collections (id) on delete cascade,
    label text not null,
    file_url text not null,
    sort_order int not null,
    unique (collection_id, sort_order)
);

create index if not exists skybox_collection_slots_collection_id_idx
    on public.skybox_collection_slots (collection_id);

alter table public.world_environments
    add column if not exists skybox_collection_id uuid references public.skybox_collections (id) on delete set null;

create index if not exists world_environments_skybox_collection_id_idx
    on public.world_environments (skybox_collection_id);

alter table public.skybox_collections enable row level security;
alter table public.skybox_collection_slots enable row level security;

create policy "skybox_collections_select_public"
    on public.skybox_collections for select
    using (true);

create policy "skybox_collections_insert_authenticated"
    on public.skybox_collections for insert to authenticated
    with check (true);

create policy "skybox_collections_update_authenticated"
    on public.skybox_collections for update to authenticated
    using (true)
    with check (true);

create policy "skybox_collections_delete_authenticated"
    on public.skybox_collections for delete to authenticated
    using (true);

create policy "skybox_collection_slots_select_public"
    on public.skybox_collection_slots for select
    using (true);

create policy "skybox_collection_slots_insert_authenticated"
    on public.skybox_collection_slots for insert to authenticated
    with check (true);

create policy "skybox_collection_slots_update_authenticated"
    on public.skybox_collection_slots for update to authenticated
    using (true)
    with check (true);

create policy "skybox_collection_slots_delete_authenticated"
    on public.skybox_collection_slots for delete to authenticated
    using (true);

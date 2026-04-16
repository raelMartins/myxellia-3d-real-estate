-- Optional JSON footprint for building on uploaded world ground (axis-aligned pad in ground-root space).
alter table public.buildings
    add column if not exists ground_placement_pad jsonb;

comment on column public.buildings.ground_placement_pad is
    'Placement pad on world ground: { "center": [x,z], "halfExtents": [hx,hz], "padDisplayMode": "flat" | "followTerrain" }';

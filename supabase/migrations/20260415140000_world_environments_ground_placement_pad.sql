-- Default / template placement pad for a world environment (same JSON shape as buildings.ground_placement_pad).
alter table public.world_environments
    add column if not exists ground_placement_pad jsonb;

comment on column public.world_environments.ground_placement_pad is
    'Optional template pad for this ground: { "center": [x,z], "halfExtents": [hx,hz], "padDisplayMode": "flat" | "followTerrain" }. Buildings inherit when they have no pad.';

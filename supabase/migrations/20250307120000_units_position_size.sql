-- Store 3D position and size for unit boxes so they can be placed/dragged in the engine.
-- position: [x, y, z] in scene space; size: [width, height, depth].
alter table public.units
  add column if not exists position jsonb default null,
  add column if not exists size jsonb default null;

comment on column public.units.position is '3D position [x,y,z] for unit box in engine';
comment on column public.units.size is '3D size [w,h,d] for unit box in engine';

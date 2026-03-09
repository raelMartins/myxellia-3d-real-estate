-- Store 2D footprint polygon for prism-shaped units. Array of [x, z] in normalized space.
alter table public.units
  add column if not exists footprint jsonb default null;

comment on column public.units.footprint is '2D footprint [[x,z], ...] for prism shape; null = box';

-- Horizontal rotation (Y-axis) for unit prisms in the engine, in radians.
alter table public.units
  add column if not exists rotation double precision default 0;

comment on column public.units.rotation is 'Y-axis rotation in radians for unit prism in engine';

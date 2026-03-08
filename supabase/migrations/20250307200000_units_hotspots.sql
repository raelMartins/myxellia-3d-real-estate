-- Interior view hotspots per unit: position in 3D + title/material/description.
-- Stored as JSONB array: [{ id, position: [x,y,z], title, material?, description? }]
alter table public.units
  add column if not exists hotspots jsonb default '[]';

comment on column public.units.hotspots is 'Interior hotspots: [{ id, position: [x,y,z], title, material?, description? }]';

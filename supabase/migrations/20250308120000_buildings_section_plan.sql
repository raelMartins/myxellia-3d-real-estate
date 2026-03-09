-- Store section plan for "Add Units By Section": base dimensions and section polygons (gold lines).
alter table public.buildings
  add column if not exists section_plan jsonb default null;

comment on column public.buildings.section_plan is 'Section plan: { baseWidth, baseDepth, sections: [{ id, label, footprint }] }';

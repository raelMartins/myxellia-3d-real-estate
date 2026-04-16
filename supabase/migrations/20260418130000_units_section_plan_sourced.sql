-- Units created from the building section plan flow: geometry is edited only via re-applying the plan.
alter table public.units
  add column if not exists section_plan_sourced boolean not null default false;

comment on column public.units.section_plan_sourced is
  'True when the unit was generated from the building plan / section stack flow; 3D box transforms and sidebar size edits are disabled.';

-- Fix RLS: ensure explicit INSERT policies exist for buildings and units.
-- Inserts require an authenticated user with admin role (auth.uid() set via JWT, not anon key).

-- Buildings: drop any conflicting or legacy policies, ensure insert/update for admins
drop policy if exists "Managers can edit buildings." on public.buildings;
drop policy if exists "Only admins can insert buildings." on public.buildings;
drop policy if exists "Only admins can update buildings." on public.buildings;

create policy "Only admins can insert buildings." on public.buildings
  for insert with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

create policy "Only admins can update buildings." on public.buildings
  for update using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

-- Units: ensure insert for admins
drop policy if exists "Only admins can insert units." on public.units;

create policy "Only admins can insert units." on public.units
  for insert with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

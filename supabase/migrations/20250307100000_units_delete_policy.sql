-- Allow admins to delete units. Without this, DELETE on units is blocked by RLS
-- and the request can hang or complete without deleting.
create policy "Only admins can delete units." on public.units
  for delete using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

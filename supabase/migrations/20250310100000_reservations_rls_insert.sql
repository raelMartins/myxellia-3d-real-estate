-- Fix RLS on reservations so authenticated users can insert their own row.
-- Required: JWT must be sent (Authorization: Bearer <access_token>) so auth.uid() is set.

drop policy if exists "Users can view their own reservations, admins view all." on public.reservations;
drop policy if exists "Users can insert their own reservations." on public.reservations;
drop policy if exists "Only admins can update reservations." on public.reservations;

create policy "Users can view their own reservations, admins view all." on public.reservations
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

create policy "Users can insert their own reservations." on public.reservations
  for insert with check (auth.uid() = user_id);

create policy "Only admins can update reservations." on public.reservations
  for update using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

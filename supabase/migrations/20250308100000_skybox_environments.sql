-- Skybox environments: admin-uploaded HDR images with labels for exterior view
create table if not exists public.skybox_environments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  label text not null,
  file_url text not null
);

comment on table public.skybox_environments is 'Admin-uploaded HDR skybox images with labels; used in Deploy grid and Engine skybox selector.';

alter table public.skybox_environments enable row level security;

create policy "Skybox environments are viewable by everyone."
  on public.skybox_environments for select using (true);

create policy "Only admins can insert skybox environments."
  on public.skybox_environments for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Only admins can update skybox environments."
  on public.skybox_environments for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Only admins can delete skybox environments."
  on public.skybox_environments for delete using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Storage bucket for HDR skybox files (run in Supabase dashboard if this fails in migration)
insert into storage.buckets (id, name, public)
values ('skyboxes', 'skyboxes', true)
on conflict (id) do nothing;

-- Allow public read for skybox files
create policy "Skybox files are publicly readable"
  on storage.objects for select
  using (bucket_id = 'skyboxes');

-- Only admins can upload/update/delete in skyboxes bucket
create policy "Admins can insert skybox files"
  on storage.objects for insert
  with check (
    bucket_id = 'skyboxes'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update skybox files"
  on storage.objects for update
  using (
    bucket_id = 'skyboxes'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete skybox files"
  on storage.objects for delete
  using (
    bucket_id = 'skyboxes'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

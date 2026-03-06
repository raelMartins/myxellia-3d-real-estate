-- MYXELLIA 3D REAL ESTATE - SQL SETUP SCRIPT
-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. TABLES SETUP
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  role text check (role in ('admin', 'client')) default 'client' not null,
  full_name text,
  company text
);

create table if not exists public.buildings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text,
  model_url text,
  thumbnail_url text,
  location text,
  total_units integer not null default 0
);

create table if not exists public.units (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  building_id uuid references public.buildings on delete cascade not null,
  unit_number text not null,
  floor integer not null,
  price numeric,
  area_sqm numeric,
  bedrooms integer,
  bathrooms integer,
  status text check (status in ('available', 'pending', 'sold')) default 'available' not null,
  locked_at timestamp with time zone,
  locked_by uuid references auth.users on delete set null,
  mesh_id text,
  unique(building_id, unit_number)
);

create table if not exists public.reservations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unit_id uuid references public.units on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  status text check (status in ('soft_lock', 'approved', 'rejected', 'expired')) default 'soft_lock' not null,
  expires_at timestamp with time zone,
  unique(unit_id, user_id, status)
);

-- 2. RLS SETUP
alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.reservations enable row level security;

-- Profiles: Viewable by all, editable only by owner
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Buildings: Viewable by all; only admins can insert/update
drop policy if exists "Buildings are viewable by everyone." on public.buildings;
create policy "Buildings are viewable by everyone." on public.buildings for select using (true);

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

-- Units: Viewable by all; admins can insert/update, clients can lock
drop policy if exists "Units viewable by all." on public.units;
create policy "Units viewable by all." on public.units for select using (true);

drop policy if exists "Admins/Clients can act on units." on public.units;
drop policy if exists "Only admins can insert units." on public.units;

create policy "Only admins can insert units." on public.units
  for insert with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

create policy "Admins/Clients can act on units." on public.units for update using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  or (auth.uid() is not null)
);

-- 3. AUTOMATION: Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. REALTIME SETUP
alter publication supabase_realtime add table public.units;
alter publication supabase_realtime add table public.reservations;

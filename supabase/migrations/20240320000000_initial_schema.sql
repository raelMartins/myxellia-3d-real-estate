-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  role text check (role in ('admin', 'client')) default 'client' not null,
  full_name text,
  company text
);

-- Create buildings table
create table public.buildings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text,
  model_url text,
  thumbnail_url text,
  location text,
  total_units integer not null default 0
);

-- Create units table
create table public.units (
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

-- Create reservations table
create table public.reservations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unit_id uuid references public.units on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  status text check (status in ('soft_lock', 'approved', 'rejected', 'expired')) default 'soft_lock' not null,
  expires_at timestamp with time zone,
  unique(unit_id, user_id, status)
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.reservations enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- Buildings policies
create policy "Buildings are viewable by everyone." on public.buildings
  for select using (true);

create policy "Only admins can insert buildings." on public.buildings
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Only admins can update buildings." on public.buildings
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Units policies
create policy "Units are viewable by everyone." on public.units
  for select using (true);

create policy "Only admins can insert units." on public.units
  for insert with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update units, clients can lock units." on public.units
  for update using (
    -- Admin can update anything
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
    or 
    -- Client can only update status to pending and set lock
    (
      status = 'available' 
      and auth.uid() is not null
    )
    or
    -- Client can unlock their own locks
    (
      locked_by = auth.uid()
    )
  );

-- Reservations policies
create policy "Users can view their own reservations, admins view all." on public.reservations
  for select using (
    auth.uid() = user_id
    or
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Users can insert their own reservations." on public.reservations
  for insert with check (auth.uid() = user_id);

create policy "Only admins can update reservations." on public.reservations
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Set up Realtime
alter publication supabase_realtime add table public.units;
alter publication supabase_realtime add table public.reservations;

# Running migrations: Dashboard vs CLI

## Why `supabase db push` fails after using the Dashboard

If you applied SQL manually in the **Supabase Dashboard** (SQL Editor), the database already has those tables. The CLI does not know that—it runs **all** migration files in order. So it tries to run the first migration again (e.g. create `profiles`) and fails with "relation already exists".

## Option 1: Keep using the Dashboard (simplest)

For the **units metadata** migration, run this in **Supabase Dashboard → SQL Editor**:

```sql
-- Unit metadata for admin-editable info clients see when reserving.
alter table public.units
  add column if not exists display_name text,
  add column if not exists view_type text,
  add column if not exists amenities text,
  add column if not exists perks text,
  add column if not exists internal_model_url text;

comment on column public.units.display_name is 'Optional display name (e.g. "Skyline Penthouse")';
comment on column public.units.view_type is 'View description (e.g. City, Garden, Pool)';
comment on column public.units.amenities is 'Comma-separated or list of amenities';
comment on column public.units.perks is 'Perks or special offers text';
comment on column public.units.internal_model_url is 'URL for unit interior 3D model (admin only)';
```

## Option 2: Use the CLI and fix migration history

So that `supabase db push` only runs **new** migrations, tell Supabase that the migrations already applied on the remote DB are “applied” in the migration history.

1. **Link your project** (if not already):
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **Mark each already-applied migration as applied** (so the CLI won’t run them again):
   ```bash
   npx supabase migration repair 20240320000000 --status applied
   npx supabase migration repair 20250305000000 --status applied
   npx supabase migration repair 20250305100000 --status applied
   npx supabase migration repair 20250305110000 --status applied
   ```
   Use the exact migration version names from your `supabase/migrations` folder (the timestamp prefix of each file).

3. **Push only the new migration**:
   ```bash
   npx supabase db push
   ```

After this, future `db push` runs will only execute migrations that haven’t been marked as applied.

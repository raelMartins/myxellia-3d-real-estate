-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor (you must be logged in as the user
-- you want to fix, OR run as service role and replace MY_USER_ID below).
-- =============================================================================

-- 1) DIAGNOSE: See if the current user has a profile and what role they have.
--    (Run this first while logged in as your admin account.)
select
  auth.uid() as my_auth_id,
  p.id as profile_id,
  p.role as profile_role,
  case
    when p.id is null then 'NO PROFILE ROW – insert one below'
    when p.role <> 'admin' then 'Profile exists but role is not admin – update below'
    else 'OK – you have admin in public.profiles'
  end as diagnosis
from (select auth.uid() as uid) u
left join public.profiles p on p.id = u.uid;

-- 2) FIX A: Ensure a profile exists for the current user and set role to admin.
--    (Only run if step 1 said "NO PROFILE ROW" or "role is not admin".)
insert into public.profiles (id, role)
values (auth.uid(), 'admin')
on conflict (id) do update set role = 'admin';

-- 2) FIX B: If you use service role and need to fix a specific user by id:
--    Replace MY_USER_ID with the uuid from Auth → Users in Supabase dashboard.
-- insert into public.profiles (id, role)
-- values ('MY_USER_ID'::uuid, 'admin')
-- on conflict (id) do update set role = 'admin';

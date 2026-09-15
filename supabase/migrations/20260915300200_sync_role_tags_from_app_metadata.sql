-- HomeLy · migration 0014 (Step 4: staff invites)
-- The Auth Admin API (auth.admin.createUser) inserts the auth.users row FIRST
-- and writes app_metadata in a follow-up UPDATE. The Step 1 AFTER INSERT
-- trigger therefore never sees role_tags for Admin-API-created users and
-- defaults the profile to {landlord}. (Direct SQL inserts, like seed.sql, do
-- carry app_metadata on insert, which is why this was not visible before.)
--
-- Fix: whenever raw_app_meta_data.role_tags changes on auth.users, mirror it
-- into profiles.role_tags. app_metadata is only ever written server-side
-- (service role), so this keeps it the single source of truth for roles.

create or replace function public.sync_profile_role_tags_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tags text[];
begin
  if new.raw_app_meta_data ? 'role_tags'
     and new.raw_app_meta_data -> 'role_tags' is distinct from old.raw_app_meta_data -> 'role_tags' then
    select array_agg(value)
      into tags
      from jsonb_array_elements_text(new.raw_app_meta_data -> 'role_tags');

    update public.profiles
       set role_tags = coalesce(tags, '{}'::text[])
     where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_profile_role_tags_from_auth();

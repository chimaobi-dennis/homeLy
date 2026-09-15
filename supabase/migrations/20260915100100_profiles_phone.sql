-- HomeLy · migration 0007 (Step 2: landlord onboarding)
-- Contact phone on profiles, captured at sign-up from user_metadata.phone.

alter table public.profiles
  add column phone text;

comment on column public.profiles.phone is 'Contact / WhatsApp number supplied at sign-up. Free text, not verified.';

-- Recreate the sign-up trigger function so it also copies `phone` from
-- raw_user_meta_data. Behaviour for role_tags / full_name is unchanged.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tags text[];
begin
  if new.raw_app_meta_data ? 'role_tags' then
    select array_agg(value)
      into tags
      from jsonb_array_elements_text(new.raw_app_meta_data -> 'role_tags');
  end if;

  insert into public.profiles (id, full_name, phone, role_tags)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    coalesce(tags, array['landlord']::text[])
  );
  return new;
end;
$$;

-- HomeLy · LOCAL DEVELOPMENT SEED
-- Runs only on `supabase db reset` / `supabase start` against the LOCAL stack.
-- `supabase db push` never executes this file, so nothing here reaches cloud.
--
-- Creates three dev accounts (password for all: `homely-dev-password`):
--   admin@homely.local     role_tags {admin}
--   staff@homely.local     role_tags {bd,inspector}   (one account, both tags)
--   landlord@homely.local  role_tags {landlord}       + a landlords row
--
-- Users are inserted directly into auth.users; the on_auth_user_created trigger
-- creates the matching public.profiles rows (role_tags from raw_app_meta_data).

do $$
declare
  admin_id    uuid := '00000000-0000-4000-8000-000000000001';
  staff_id    uuid := '00000000-0000-4000-8000-000000000002';
  landlord_id uuid := '00000000-0000-4000-8000-000000000003';
  pw          text := extensions.crypt('homely-dev-password', extensions.gen_salt('bf'));
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values
  (
    '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
    'admin@homely.local', pw, now(),
    '{"provider":"email","providers":["email"],"role_tags":["admin"]}'::jsonb,
    '{"full_name":"Dev Admin"}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', staff_id, 'authenticated', 'authenticated',
    'staff@homely.local', pw, now(),
    '{"provider":"email","providers":["email"],"role_tags":["bd","inspector"]}'::jsonb,
    '{"full_name":"Dev Staff (BD + Inspector)"}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', landlord_id, 'authenticated', 'authenticated',
    'landlord@homely.local', pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dev Landlord"}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
    from auth.users u
   where u.id in (admin_id, staff_id, landlord_id);

  insert into public.landlords (id, country_of_residence, status, assigned_ops_contact)
  values (landlord_id, 'Nigeria', 'applied', staff_id);
end;
$$;

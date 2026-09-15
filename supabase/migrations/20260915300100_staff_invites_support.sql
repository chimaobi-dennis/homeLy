-- HomeLy · migration 0013 (Step 4: staff invites)
-- The staff_invites table (Step 1) is unchanged. Two supporting pieces:
--
-- 1. email_is_registered(): lets trusted server code ask "does this email
--    already belong to an auth user?" before issuing an invite, without
--    listing users. SECURITY DEFINER over auth.users, returns only a boolean,
--    executable by the service role ONLY (anon / authenticated get 42501).
-- 2. One PENDING invite per email (partial unique index). Accepted, revoked
--    and expired rows are kept for audit.

create or replace function public.email_is_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
     where lower(u.email) = lower(btrim(p_email))
  );
$$;

revoke execute on function public.email_is_registered(text) from public, anon, authenticated;
grant  execute on function public.email_is_registered(text) to service_role;

comment on function public.email_is_registered(text) is 'Service-role only. True when an auth user with this email exists.';

create unique index staff_invites_one_pending_per_email_idx
  on public.staff_invites (lower(email))
  where status = 'pending';

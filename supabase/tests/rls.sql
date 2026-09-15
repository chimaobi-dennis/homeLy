-- HomeLy · RLS regression test
-- Runs entirely inside one transaction and ROLLS BACK, so it never leaves data
-- behind. Impersonates admin / staff / landlord / anon / service_role by
-- switching the DB role and setting request.jwt.claims, exactly as PostgREST does.
--
-- Run against the local stack:   npm run db:test
-- (needs Docker on PATH; see package.json)
--
-- Expected last line: ALL RLS CHECKS PASSED
\set ON_ERROR_STOP on
begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres). Rolled back at the end.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values
 ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-0000000000a1','authenticated','authenticated','t-admin@test.local','x',now(),'{"role_tags":["admin"]}','{"full_name":"T Admin"}',now(),now(),'','','','','','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-0000000000a2','authenticated','authenticated','t-staff@test.local','x',now(),'{"role_tags":["bd","inspector"]}','{"full_name":"T Staff"}',now(),now(),'','','','','','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-0000000000a3','authenticated','authenticated','t-landlord-a@test.local','x',now(),'{}','{"full_name":"T Landlord A"}',now(),now(),'','','','','','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-0000000000a4','authenticated','authenticated','t-landlord-b@test.local','x',now(),'{}','{"full_name":"T Landlord B"}',now(),now(),'','','','','','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-0000000000a5','authenticated','authenticated','t-new@test.local','x',now(),'{}','{"full_name":"  "}',now(),now(),'','','','','','','','');

do $$ begin
  assert (select role_tags from public.profiles where id='10000000-0000-4000-8000-0000000000a1') = '{admin}', 'trigger: admin tags from app_metadata';
  assert (select role_tags from public.profiles where id='10000000-0000-4000-8000-0000000000a2') = '{bd,inspector}', 'trigger: staff holds both tags';
  assert (select role_tags from public.profiles where id='10000000-0000-4000-8000-0000000000a3') = '{landlord}', 'trigger: default tag is landlord';
  assert (select full_name from public.profiles where id='10000000-0000-4000-8000-0000000000a1') = 'T Admin', 'trigger: full_name from user_metadata';
  assert (select full_name from public.profiles where id='10000000-0000-4000-8000-0000000000a5') is null, 'trigger: blank full_name becomes null';
  raise notice 'PASS trigger: profiles auto-created with correct role_tags';
end $$;

insert into public.landlords (id, country_of_residence, status, assigned_ops_contact) values
 ('10000000-0000-4000-8000-0000000000a3','Nigeria','kyc_verified','10000000-0000-4000-8000-0000000000a2'),
 ('10000000-0000-4000-8000-0000000000a4','United Kingdom','applied',null);
insert into public.properties (id, landlord_id, address, bedrooms, target_annual_rent) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a3','1 Test Street, Independence Layout',2,1500000),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-0000000000a4','2 Test Street, GRA',3,2500000);
insert into public.staff_invites (id, email, role_tags, invited_by) values
 ('30000000-0000-4000-8000-000000000001','invitee@test.local','{bd}','10000000-0000-4000-8000-0000000000a1');
insert into public.waitlist_entries (id, name, whatsapp_number, email) values
 ('40000000-0000-4000-8000-000000000001','W One','+2348012345678','w1@test.local');

do $$ begin
  assert (select length(token) from public.staff_invites where id='30000000-0000-4000-8000-000000000001') = 64, 'staff_invites.token default is 64 hex chars';
  assert (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) = 0, 'every public table has RLS enabled';
  raise notice 'PASS schema: token default + RLS enabled everywhere';
end $$;

-- ===========================================================================
-- ADMIN (a1)
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  assert public.is_admin(), 'admin: is_admin()';
  assert (select count(*) from public.profiles where id::text like '10000000-%') = 5, 'admin: selects all profiles';
  assert (select count(*) from public.landlords where id::text like '10000000-%') = 2, 'admin: selects all landlords';
  assert (select count(*) from public.properties where id::text like '20000000-%') = 2, 'admin: selects all properties';
  assert (select count(*) from public.staff_invites where id::text like '30000000-%') = 1, 'admin: selects staff_invites';
  assert (select count(*) from public.waitlist_entries where id::text like '40000000-%') = 1, 'admin: selects waitlist';

  update public.landlords set status='kyc_rejected', assigned_ops_contact='10000000-0000-4000-8000-0000000000a2' where id='10000000-0000-4000-8000-0000000000a4';
  get diagnostics n = row_count; assert n = 1, 'admin: updates landlord status';
  update public.properties set status='listed' where id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'admin: updates property status';
  insert into public.staff_invites (email, role_tags, invited_by) values ('second@test.local','{bd,inspector}','10000000-0000-4000-8000-0000000000a1');
  update public.staff_invites set status='revoked' where id='30000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'admin: updates staff_invite';
  update public.profiles set full_name='T Admin 2' where id='10000000-0000-4000-8000-0000000000a1';
  get diagnostics n = row_count; assert n = 1, 'admin: updates own profile';

  -- Spec is select-only for admin on other profiles → RLS filters to 0 rows.
  update public.profiles set full_name='hacked' where id='10000000-0000-4000-8000-0000000000a4';
  get diagnostics n = row_count; assert n = 0, 'admin: cannot update other profiles (spec: select only)';

  -- No client UPDATE grant on waitlist at all.
  ok := false;
  begin update public.waitlist_entries set email_confirmed=true where id='40000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'admin: cannot update waitlist via client';

  ok := false;
  begin delete from public.staff_invites where id='30000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'admin: cannot delete staff_invites via client';
  raise notice 'PASS admin policies';
end $$;

-- ===========================================================================
-- STAFF (a2: bd + inspector)
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  assert public.is_staff_or_admin() and not public.is_admin(), 'staff: is_staff_or_admin, not admin';
  assert public.has_role('bd') and public.has_role('inspector'), 'staff: holds both tags';
  assert (select count(*) from public.profiles where id::text like '10000000-%') = 1, 'staff: sees only own profile';
  assert (select count(*) from public.landlords where id::text like '10000000-%') = 2, 'staff: selects all landlords';
  assert (select count(*) from public.properties where id::text like '20000000-%') = 2, 'staff: selects all properties';
  assert (select count(*) from public.staff_invites) = 0, 'staff: cannot read staff_invites';
  assert (select count(*) from public.waitlist_entries where id::text like '40000000-%') = 1, 'staff: selects waitlist';

  ok := false;
  begin insert into public.staff_invites (email, role_tags) values ('x@test.local','{bd}');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'staff: cannot insert staff_invites';

  update public.landlords set country_of_residence='Ghana' where id='10000000-0000-4000-8000-0000000000a3';
  get diagnostics n = row_count; assert n = 0, 'staff: cannot update landlords';
  update public.properties set address='changed' where id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 0, 'staff: cannot update properties';

  ok := false;
  begin insert into public.landlords (id, country_of_residence) values ('10000000-0000-4000-8000-0000000000a2','Nigeria');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'staff: cannot insert a landlords row for themselves (no landlord tag)';
  raise notice 'PASS staff policies';
end $$;

-- ===========================================================================
-- LANDLORD A (a3)
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  assert public.has_role('landlord') and not public.is_staff_or_admin(), 'landlord: tags';
  assert (select count(*) from public.profiles where id::text like '10000000-%') = 1, 'landlord: sees only own profile';
  assert (select count(*) from public.landlords where id::text like '10000000-%') = 1, 'landlord: sees only own landlord row';
  assert (select id from public.landlords where id::text like '10000000-%') = '10000000-0000-4000-8000-0000000000a3', 'landlord: own row is the visible one';
  assert (select count(*) from public.properties where id::text like '20000000-%') = 1, 'landlord: sees only own properties';
  assert (select count(*) from public.staff_invites) = 0, 'landlord: cannot read staff_invites';
  assert (select count(*) from public.waitlist_entries) = 0, 'landlord: cannot read waitlist';

  update public.landlords set country_of_residence='Ghana' where id='10000000-0000-4000-8000-0000000000a3';
  get diagnostics n = row_count; assert n = 1, 'landlord: updates own non-protected column';

  ok := false;
  begin update public.landlords set status='kyc_rejected' where id='10000000-0000-4000-8000-0000000000a3';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot change own status (trigger)';
  -- same value is fine (no change)
  update public.landlords set status='kyc_verified' where id='10000000-0000-4000-8000-0000000000a3';
  get diagnostics n = row_count; assert n = 1, 'landlord: no-op status write allowed';

  ok := false;
  begin update public.landlords set assigned_ops_contact=null where id='10000000-0000-4000-8000-0000000000a3';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot change assigned_ops_contact';

  update public.landlords set country_of_residence='X' where id='10000000-0000-4000-8000-0000000000a4';
  get diagnostics n = row_count; assert n = 0, 'landlord: cannot update other landlord';

  insert into public.properties (landlord_id, address, bedrooms, target_annual_rent) values ('10000000-0000-4000-8000-0000000000a3','3 New St',1,800000);
  assert (select status from public.properties where address='3 New St') = 'submitted', 'landlord: inserts own property, status defaults to submitted';

  ok := false;
  begin insert into public.properties (landlord_id, address, bedrooms, target_annual_rent, status) values ('10000000-0000-4000-8000-0000000000a3','4 New St',1,800000,'listed');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot insert property with non-default status';

  ok := false;
  begin insert into public.properties (landlord_id, address, bedrooms, target_annual_rent) values ('10000000-0000-4000-8000-0000000000a4','5 New St',1,800000);
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot insert property for another landlord';

  ok := false;
  begin update public.properties set status='under_inspection' where id='20000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot change own property status';

  update public.properties set address='1 Test Street (edited)' where id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'landlord: updates own property address';
  update public.properties set address='hacked' where id='20000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count; assert n = 0, 'landlord: cannot update other landlord property';

  ok := false;
  begin update public.profiles set role_tags='{admin}' where id='10000000-0000-4000-8000-0000000000a3';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot self-promote role_tags';
  update public.profiles set full_name='Landlord A (edited)' where id='10000000-0000-4000-8000-0000000000a3';
  get diagnostics n = row_count; assert n = 1, 'landlord: updates own full_name';
  update public.profiles set full_name='hacked' where id='10000000-0000-4000-8000-0000000000a4';
  get diagnostics n = row_count; assert n = 0, 'landlord: cannot update other profile';

  insert into public.waitlist_entries (name, whatsapp_number, email) values ('Signed-in joiner','08012345678','joiner@test.local');
  raise notice 'PASS landlord policies';
end $$;

-- ===========================================================================
-- NEW LANDLORD (a5) — apply flow: creates own landlords row
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;
do $$ declare ok boolean; begin
  ok := false;
  begin insert into public.landlords (id, country_of_residence, status) values ('10000000-0000-4000-8000-0000000000a5','Nigeria','kyc_verified');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'new landlord: cannot insert with non-default status';
  ok := false;
  begin insert into public.landlords (id, country_of_residence) values ('10000000-0000-4000-8000-0000000000a4','Nigeria');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'new landlord: cannot insert a row for someone else';
  insert into public.landlords (id, country_of_residence) values ('10000000-0000-4000-8000-0000000000a5','Nigeria');
  assert (select status from public.landlords where id='10000000-0000-4000-8000-0000000000a5') = 'applied', 'new landlord: own row created with status applied';
  raise notice 'PASS new-landlord apply insert';
end $$;

-- ===========================================================================
-- ANON
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ declare ok boolean; begin
  insert into public.waitlist_entries (name, whatsapp_number, email) values ('Anon Joiner','+234 801 234 5678','anon@test.local');

  ok := false;
  begin insert into public.waitlist_entries (name, whatsapp_number, email, email_confirmed) values ('Anon','08012345678','a2@test.local',true);
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot set email_confirmed on insert';
  ok := false;
  begin insert into public.waitlist_entries (name, whatsapp_number, email, conversion_status) values ('Anon','08012345678','a3@test.local','active_queue');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot set conversion_status on insert';
  ok := false;
  begin insert into public.waitlist_entries (name, whatsapp_number, email) values ('Anon','08012345678','not-an-email');
  exception when check_violation then ok := true; end;
  assert ok, 'anon: invalid email rejected by check';
  ok := false;
  begin insert into public.waitlist_entries (name, whatsapp_number, email) values ('Anon','call me','a4@test.local');
  exception when check_violation then ok := true; end;
  assert ok, 'anon: invalid whatsapp rejected by check';

  ok := false; begin perform count(*) from public.waitlist_entries; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot select waitlist';
  ok := false; begin update public.waitlist_entries set name='x'; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot update waitlist';
  ok := false; begin delete from public.waitlist_entries; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot delete waitlist';
  ok := false; begin perform count(*) from public.profiles; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot select profiles';
  ok := false; begin perform count(*) from public.landlords; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot select landlords';
  ok := false; begin perform count(*) from public.properties; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot select properties';
  ok := false; begin perform count(*) from public.staff_invites; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot select staff_invites';
  raise notice 'PASS anon policies';
end $$;

-- ===========================================================================
-- SERVICE ROLE (bypasses RLS; triggers must let it through)
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ declare n int; begin
  update public.waitlist_entries set email_confirmed=true, conversion_status='invited_to_convert' where id='40000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'service_role: updates waitlist flags';
  update public.landlords set status='kyc_pending' where id='10000000-0000-4000-8000-0000000000a5';
  get diagnostics n = row_count; assert n = 1, 'service_role: updates landlord status';
  update public.profiles set role_tags='{bd}' where id='10000000-0000-4000-8000-0000000000a5';
  get diagnostics n = row_count; assert n = 1, 'service_role: updates role_tags';
  assert (select count(*) from public.staff_invites where id::text like '30000000-%') = 1, 'service_role: reads staff_invites';
  raise notice 'PASS service_role';
end $$;

reset role;
rollback;
\echo ALL RLS CHECKS PASSED

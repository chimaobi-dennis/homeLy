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
 ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-0000000000a5','authenticated','authenticated','t-new@test.local','x',now(),'{}','{"full_name":"  "}',now(),now(),'','','','','','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-0000000000a6','authenticated','authenticated','t-phone@test.local','x',now(),'{}','{"full_name":"T Phone","phone":"+2348000000006"}',now(),now(),'','','','','','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-0000000000a7','authenticated','authenticated','t-tenant@test.local','x',now(),'{"role_tags":["tenant"]}','{"full_name":"T Tenant"}',now(),now(),'','','','','','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-0000000000a8','authenticated','authenticated','t-tenant-unverified@test.local','x',now(),'{"role_tags":["tenant"]}','{"full_name":"T Unverified"}',now(),now(),'','','','','','','','');

do $$ begin
  assert (select role_tags from public.profiles where id='10000000-0000-4000-8000-0000000000a1') = '{admin}', 'trigger: admin tags from app_metadata';
  assert (select role_tags from public.profiles where id='10000000-0000-4000-8000-0000000000a2') = '{bd,inspector}', 'trigger: staff holds both tags';
  assert (select role_tags from public.profiles where id='10000000-0000-4000-8000-0000000000a3') = '{landlord}', 'trigger: default tag is landlord';
  assert (select full_name from public.profiles where id='10000000-0000-4000-8000-0000000000a1') = 'T Admin', 'trigger: full_name from user_metadata';
  assert (select full_name from public.profiles where id='10000000-0000-4000-8000-0000000000a5') is null, 'trigger: blank full_name becomes null';
  assert (select phone from public.profiles where id='10000000-0000-4000-8000-0000000000a6') = '+2348000000006', 'trigger: phone copied from user_metadata';
  -- Step 4: Admin-API path = app_metadata written AFTER insert → profile must follow.
  update auth.users set raw_app_meta_data = '{"provider":"email","providers":["email"],"role_tags":["bd","inspector"]}'::jsonb
   where id='10000000-0000-4000-8000-0000000000a6';
  assert (select role_tags from public.profiles where id='10000000-0000-4000-8000-0000000000a6') = '{bd,inspector}', 'trigger: role_tags synced from later app_metadata update';
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"x":1}'::jsonb where id='10000000-0000-4000-8000-0000000000a6';
  assert (select role_tags from public.profiles where id='10000000-0000-4000-8000-0000000000a6') = '{bd,inspector}', 'trigger: unrelated auth.users update leaves role_tags alone';
  assert (select role_tags from public.profiles where id='10000000-0000-4000-8000-0000000000a7') = '{tenant}', 'trigger: tenant tag accepted (Step 5)';
  raise notice 'PASS trigger: profiles auto-created with correct role_tags';
end $$;

insert into public.landlords (id, country_of_residence, status, assigned_ops_contact) values
 ('10000000-0000-4000-8000-0000000000a3','Nigeria','kyc_verified','10000000-0000-4000-8000-0000000000a2'),
 ('10000000-0000-4000-8000-0000000000a4','United Kingdom','applied',null);
insert into public.properties (id, landlord_id, address, bedrooms, target_annual_rent) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-0000000000a3','1 Test Street, Independence Layout',2,1500000),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-0000000000a4','2 Test Street, GRA',3,2500000),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-0000000000a3','3 Rejected Street, Trans Ekulu',1,500000);
update public.properties set status='rejected', rejection_reason='fixture' where id='20000000-0000-4000-8000-000000000003';
insert into public.staff_invites (id, email, role_tags, invited_by) values
 ('30000000-0000-4000-8000-000000000001','invitee@test.local','{bd}','10000000-0000-4000-8000-0000000000a1');
insert into public.waitlist_entries (id, name, whatsapp_number, email) values
 ('40000000-0000-4000-8000-000000000001','W One','+2348012345678','w1@test.local'),
 ('40000000-0000-4000-8000-000000000002','W Two','+2348012345679','w2@test.local');
insert into public.tenants (id, waitlist_entry_id, kyc_status) values ('10000000-0000-4000-8000-0000000000a7','40000000-0000-4000-8000-000000000001','pending');
insert into public.tenants (id, kyc_status) values ('10000000-0000-4000-8000-0000000000a8','pending');
-- Step 7 fixtures: listing content + one photo each for p1 and p2 (p1 is listed by the admin block below).
update public.properties set description='Two-bedroom flat, first floor, tiled, borehole water.', listing_headline='Bright 2-bed in Independence Layout', amenities='{borehole_water,prepaid_meter}', bathrooms=2
 where id='20000000-0000-4000-8000-000000000001';
insert into public.property_photos (id, property_id, storage_path, sort_order) values
 ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/a.jpg',0),
 ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002/b.jpg',0);
insert into storage.objects (bucket_id, name) values
 ('property-photos','20000000-0000-4000-8000-000000000001/a.jpg'),
 ('property-photos','20000000-0000-4000-8000-000000000002/b.jpg');
insert into public.queue_conversion_invites (id, waitlist_entry_id) values ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002');

do $$ begin
  assert (select length(token) from public.staff_invites where id='30000000-0000-4000-8000-000000000001') = 64, 'staff_invites.token default is 64 hex chars';
  assert (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) = 0, 'every public table has RLS enabled';
  assert (select public from storage.buckets where id='landlord-documents') = false, 'landlord-documents bucket is private';
  assert (select file_size_limit from storage.buckets where id='landlord-documents') = 10485760, 'bucket size limit 10 MiB';
  assert (select public from storage.buckets where id='property-photos') = false, 'property-photos bucket is private';
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
  assert (select count(*) from public.profiles where id::text like '10000000-%') = 8, 'admin: selects all profiles';
  assert (select count(*) from public.landlords where id::text like '10000000-%') = 2, 'admin: selects all landlords';
  assert (select count(*) from public.properties where id::text like '20000000-%') = 3, 'admin: selects all properties';
  assert (select count(*) from public.staff_invites where id::text like '30000000-%') = 1, 'admin: selects staff_invites';
  assert (select count(*) from public.waitlist_entries where id::text like '40000000-%') = 2, 'admin: selects waitlist';

  update public.landlords set status='kyc_rejected', assigned_ops_contact='10000000-0000-4000-8000-0000000000a2' where id='10000000-0000-4000-8000-0000000000a4';
  get diagnostics n = row_count; assert n = 1, 'admin: updates landlord status';
  update public.properties set status='listed' where id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'admin: updates property status';
  insert into public.staff_invites (email, role_tags, invited_by) values ('second@test.local','{bd,inspector}','10000000-0000-4000-8000-0000000000a1');
  -- Step 4: one pending invite per email (case-insensitive)
  ok := false;
  begin insert into public.staff_invites (email, role_tags, invited_by) values ('Invitee@test.local','{inspector}','10000000-0000-4000-8000-0000000000a1');
  exception when unique_violation then ok := true; end;
  assert ok, 'admin: second pending invite for same email rejected';
  -- Step 4: admin cannot call the service-role-only email check
  ok := false;
  begin perform public.email_is_registered('t-admin@test.local');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'admin: email_is_registered is service-role only';
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
  -- Step 7: staff read landlord-tagged profiles (names for the properties list): own + a3, a4, a5.
  assert (select count(*) from public.profiles where id::text like '10000000-%') = 4, 'staff: sees own profile + landlord profiles only';
  assert (select count(*) from public.profiles where id::text like '10000000-%' and not ('landlord' = any(role_tags)) and id <> '10000000-0000-4000-8000-0000000000a2') = 0, 'staff: no admin/staff/tenant profiles visible';
  assert (select count(*) from public.landlords where id::text like '10000000-%') = 2, 'staff: selects all landlords';
  assert (select count(*) from public.properties where id::text like '20000000-%') = 3, 'staff: selects all properties';
  assert (select count(*) from public.staff_invites) = 0, 'staff: cannot read staff_invites';
  assert (select count(*) from public.waitlist_entries where id::text like '40000000-%') = 2, 'staff: selects waitlist';

  ok := false;
  begin insert into public.staff_invites (email, role_tags) values ('x@test.local','{bd}');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'staff: cannot insert staff_invites';

  update public.landlords set country_of_residence='Ghana' where id='10000000-0000-4000-8000-0000000000a3';
  get diagnostics n = row_count; assert n = 0, 'staff: cannot update landlords';
  ok := false;
  begin update public.properties set address='changed' where id='20000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'staff: cannot update core property fields (trigger, Step 7)';

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
  assert (select count(*) from public.properties where id::text like '20000000-%') = 2, 'landlord: sees only own properties';
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

  -- Step 3 (A2): p1 is 'listed' (set by admin above) → core fields locked, threshold free.
  ok := false;
  begin update public.properties set address='1 Test Street (edited)' where id='20000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot edit address once listed';
  ok := false;
  begin update public.properties set bedrooms=9 where id='20000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot edit bedrooms once listed';
  ok := false;
  begin update public.properties set target_annual_rent=1 where id='20000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot edit target rent once listed';
  update public.properties set maintenance_threshold_ngn=99000 where id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'landlord: maintenance threshold editable while listed';
  -- p3 is 'rejected' and not yet resubmitted → same lock (quiet edits are not the resubmit path).
  ok := false;
  begin update public.properties set city='Elsewhere' where id='20000000-0000-4000-8000-000000000003';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot quietly edit a rejected property';
  update public.properties set maintenance_threshold_ngn=77000 where id='20000000-0000-4000-8000-000000000003';
  get diagnostics n = row_count; assert n = 1, 'landlord: maintenance threshold editable while rejected';
  -- Still 'submitted' → core fields editable.
  update public.properties set address='3 New St (edited)', bedrooms=2 where address='3 New St';
  get diagnostics n = row_count; assert n = 1, 'landlord: edits core fields while submitted';
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
  -- Step 3 (B2): one row per email, case-insensitive; same phone is fine.
  ok := false;
  begin insert into public.waitlist_entries (name, whatsapp_number, email) values ('Anon Again','+234 801 234 5678','ANON@test.local');
  exception when unique_violation then ok := true; end;
  assert ok, 'anon: duplicate email (any case) rejected';
  insert into public.waitlist_entries (name, whatsapp_number, email) values ('Housemate','+234 801 234 5678','housemate@test.local');

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
  ok := false; begin perform public.email_is_registered('t-admin@test.local'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot call email_is_registered';
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
  update public.properties set address='3 Rejected Street (corrected)', status='submitted', rejection_reason=null
   where id='20000000-0000-4000-8000-000000000003' and status='rejected';
  get diagnostics n = row_count; assert n = 1, 'service_role: atomic resubmit passes the core-field lock';
  update public.profiles set role_tags='{bd}' where id='10000000-0000-4000-8000-0000000000a5';
  get diagnostics n = row_count; assert n = 1, 'service_role: updates role_tags';
  assert (select count(*) from public.staff_invites where id::text like '30000000-%') = 1, 'service_role: reads staff_invites';
  assert public.email_is_registered('T-ADMIN@test.local '), 'service_role: email_is_registered true for existing user (case/space-insensitive)';
  assert not public.email_is_registered('nobody@test.local'), 'service_role: email_is_registered false for unknown email';
  -- a revoked invite frees the email for a new pending one
  update public.staff_invites set status='revoked' where email='second@test.local';
  insert into public.staff_invites (email, role_tags) values ('second@test.local','{bd}');
  raise notice 'PASS service_role';
end $$;

-- ===========================================================================
-- STEP 2: documents, storage bucket policies, agreement / rejection guards
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  -- Storage: upload into own folder only
  insert into storage.objects (bucket_id, name) values ('landlord-documents', '10000000-0000-4000-8000-0000000000a3/id_document/id.pdf');
  ok := false;
  begin insert into storage.objects (bucket_id, name) values ('landlord-documents', '10000000-0000-4000-8000-0000000000a4/id_document/id.pdf');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot upload into another landlord folder';
  assert (select count(*) from storage.objects where bucket_id='landlord-documents') = 1, 'landlord: sees only own objects';
  ok := false;
  begin delete from storage.objects where bucket_id='landlord-documents';
  exception when insufficient_privilege then ok := true; end;
  if not ok then get diagnostics n = row_count; assert n = 0, 'landlord: cannot delete objects'; end if;

  -- landlord_documents metadata
  insert into public.landlord_documents (landlord_id, document_type, storage_path, original_filename, mime_type, size_bytes)
  values ('10000000-0000-4000-8000-0000000000a3','id_document','10000000-0000-4000-8000-0000000000a3/id_document/id.pdf','id.pdf','application/pdf',1234);
  ok := false;
  begin insert into public.landlord_documents (landlord_id, document_type, storage_path, original_filename, mime_type, size_bytes)
        values ('10000000-0000-4000-8000-0000000000a3','id_document','10000000-0000-4000-8000-0000000000a4/id_document/x.pdf','x.pdf','application/pdf',1);
  exception when check_violation then ok := true; end;
  assert ok, 'landlord_documents: path must be under owner folder';
  ok := false;
  begin insert into public.landlord_documents (landlord_id, document_type, storage_path, original_filename, mime_type, size_bytes)
        values ('10000000-0000-4000-8000-0000000000a4','id_document','10000000-0000-4000-8000-0000000000a4/id_document/x.pdf','x.pdf','application/pdf',1);
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord_documents: cannot insert for another landlord';
  assert (select count(*) from public.landlord_documents) = 1, 'landlord_documents: sees own row only';
  -- Step 3 (A1): proof of ownership may only point at one of MY properties.
  ok := false;
  begin insert into public.landlord_documents (landlord_id, property_id, document_type, storage_path, original_filename, mime_type, size_bytes)
        values ('10000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-000000000002','proof_of_ownership','10000000-0000-4000-8000-0000000000a3/proof_of_ownership/p.pdf','p.pdf','application/pdf',1);
  exception when check_violation then ok := true; end;
  assert ok, 'landlord_documents: cannot attach a document to another landlord property';
  insert into public.landlord_documents (landlord_id, property_id, document_type, storage_path, original_filename, mime_type, size_bytes)
  values ('10000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-000000000001','proof_of_ownership','10000000-0000-4000-8000-0000000000a3/proof_of_ownership/p.pdf','p.pdf','application/pdf',1);
  assert (select count(*) from public.landlord_documents) = 2, 'landlord_documents: proof attached to own property';
  ok := false;
  begin update public.landlord_documents set original_filename='y';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord_documents: no client update';

  -- New protected columns
  ok := false;
  begin update public.landlords set agreement_status='signed' where id='10000000-0000-4000-8000-0000000000a3';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot change agreement_status';
  ok := false;
  begin update public.landlords set kyc_rejection_reason='x' where id='10000000-0000-4000-8000-0000000000a3';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot change kyc_rejection_reason';
  ok := false;
  begin update public.properties set rejection_reason='x' where id='20000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot change property rejection_reason';
  raise notice 'PASS step2 landlord: documents + storage + guards';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
do $$ declare ok boolean; begin
  assert (select count(*) from public.landlord_documents where storage_path like '10000000-%') = 2, 'staff: reads all landlord_documents';
  assert (select count(*) from storage.objects where bucket_id='landlord-documents' and name like '10000000-%') = 1, 'staff: reads all objects in bucket';
  ok := false;
  begin insert into storage.objects (bucket_id, name) values ('landlord-documents', '10000000-0000-4000-8000-0000000000a2/id_document/id.pdf');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'staff: cannot upload to landlord-documents';
  ok := false;
  begin insert into public.landlord_documents (landlord_id, document_type, storage_path, original_filename, mime_type, size_bytes)
        values ('10000000-0000-4000-8000-0000000000a3','id_document','10000000-0000-4000-8000-0000000000a3/id_document/s.pdf','s.pdf','application/pdf',1);
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'staff: cannot insert landlord_documents';
  raise notice 'PASS step2 staff: read-only on documents';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  update public.landlords set agreement_status='pending_signature', kyc_rejection_reason='needs clearer ID' where id='10000000-0000-4000-8000-0000000000a3';
  get diagnostics n = row_count; assert n = 1, 'admin: sets agreement_status + rejection reason';
  update public.properties set rejection_reason='no C of O' where id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'admin: sets property rejection_reason';
  assert (select count(*) from storage.objects where bucket_id='landlord-documents' and name like '10000000-%') = 1, 'admin: reads bucket objects';
  raise notice 'PASS step2 admin: protected columns writable';
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ declare ok boolean; begin
  assert (select count(*) from storage.objects where bucket_id='landlord-documents') = 0, 'anon: sees no objects';
  ok := false;
  begin insert into storage.objects (bucket_id, name) values ('landlord-documents', 'x/id_document/id.pdf');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot upload';
  raise notice 'PASS step2 anon: no storage access';
end $$;

-- ===========================================================================
-- STEP 5: tenants, queue_conversion_invites, tenant_documents, tenant bucket
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a7","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  assert public.has_role('tenant') and not public.is_staff_or_admin(), 'tenant: tags';
  assert (select count(*) from public.tenants) = 1 and (select kyc_status from public.tenants) = 'pending', 'tenant: selects own row only';
  assert (select count(*) from public.landlords where id::text like '10000000-%') = 0, 'tenant: sees no landlords';
  assert (select count(*) from public.properties where id::text like '20000000-%') = 0, 'tenant: sees no properties';
  assert (select count(*) from public.queue_conversion_invites) = 0, 'tenant: cannot read conversion invites';
  assert (select count(*) from public.waitlist_entries) = 0, 'tenant: cannot read waitlist';
  -- No UPDATE policy for tenants on their own row at all: RLS matches zero rows
  -- (the guard trigger is the second line of defence for admin/service paths).
  update public.tenants set kyc_status='verified' where id='10000000-0000-4000-8000-0000000000a7';
  get diagnostics n = row_count; assert n = 0, 'tenant: cannot change own kyc_status (no update policy)';
  update public.tenants set kyc_rejection_reason='x' where id='10000000-0000-4000-8000-0000000000a7';
  get diagnostics n = row_count; assert n = 0, 'tenant: cannot change kyc_rejection_reason';
  update public.tenants set waitlist_entry_id=null where id='10000000-0000-4000-8000-0000000000a7';
  get diagnostics n = row_count; assert n = 0, 'tenant: cannot change waitlist_entry_id';
  assert (select kyc_status from public.tenants where id='10000000-0000-4000-8000-0000000000a7') = 'pending', 'tenant: row unchanged';
  -- own ID upload
  insert into storage.objects (bucket_id, name) values ('tenant-documents', '10000000-0000-4000-8000-0000000000a7/id_document/id.pdf');
  ok := false;
  begin insert into storage.objects (bucket_id, name) values ('tenant-documents', '10000000-0000-4000-8000-0000000000a3/id_document/id.pdf');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'tenant: cannot upload into another folder';
  ok := false;
  begin insert into storage.objects (bucket_id, name) values ('landlord-documents', '10000000-0000-4000-8000-0000000000a7/id_document/id.pdf');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'tenant: cannot upload into the landlord bucket';
  insert into public.tenant_documents (tenant_id, storage_path, original_filename, mime_type, size_bytes)
  values ('10000000-0000-4000-8000-0000000000a7','10000000-0000-4000-8000-0000000000a7/id_document/id.pdf','id.pdf','application/pdf',10);
  assert (select count(*) from public.tenant_documents) = 1, 'tenant: sees own document';
  ok := false;
  begin insert into public.tenant_documents (tenant_id, storage_path, original_filename, mime_type, size_bytes)
        values ('10000000-0000-4000-8000-0000000000a7','10000000-0000-4000-8000-0000000000a3/id_document/x.pdf','x.pdf','application/pdf',1);
  exception when check_violation then ok := true; end;
  assert ok, 'tenant_documents: path must be under owner folder';
  ok := false;
  begin update public.tenant_documents set original_filename='y';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'tenant_documents: no client update';
  raise notice 'PASS step5 tenant policies';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
do $$ declare ok boolean; begin
  assert (select count(*) from public.tenants) = 0, 'landlord: sees no tenants';
  assert (select count(*) from public.tenant_documents) = 0, 'landlord: sees no tenant documents';
  ok := false;
  begin insert into public.tenant_documents (tenant_id, storage_path, original_filename, mime_type, size_bytes)
        values ('10000000-0000-4000-8000-0000000000a3','10000000-0000-4000-8000-0000000000a3/id_document/x.pdf','x.pdf','application/pdf',1);
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot insert tenant_documents (no tenant tag)';
  ok := false;
  begin insert into storage.objects (bucket_id, name) values ('tenant-documents', '10000000-0000-4000-8000-0000000000a3/id_document/id.pdf');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot upload into the tenant bucket';
  raise notice 'PASS step5 landlord isolation';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; begin
  assert (select count(*) from public.tenants where id::text like '10000000-%') = 2, 'staff: selects all tenants';
  assert (select count(*) from public.tenant_documents where storage_path like '10000000-%') = 1, 'staff: selects all tenant documents';
  assert (select count(*) from storage.objects where bucket_id='tenant-documents' and name like '10000000-%') = 1, 'staff: reads tenant bucket objects';
  assert (select count(*) from public.queue_conversion_invites) = 0, 'staff: cannot read conversion invites';
  update public.tenants set kyc_rejection_reason='x' where id='10000000-0000-4000-8000-0000000000a7';
  get diagnostics n = row_count; assert n = 0, 'staff: cannot update tenants';
  raise notice 'PASS step5 staff read-only';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  update public.tenants set kyc_status='verified', kyc_rejection_reason=null where id='10000000-0000-4000-8000-0000000000a7';
  get diagnostics n = row_count; assert n = 1, 'admin: sets tenant kyc_status';
  assert (select count(*) from public.queue_conversion_invites where id::text like '50000000-%') = 1, 'admin: reads conversion invites';
  assert (select length(token) from public.queue_conversion_invites where id='50000000-0000-4000-8000-000000000001') = 64, 'conversion invite token default is 64 hex';
  ok := false;
  begin insert into public.queue_conversion_invites (waitlist_entry_id) values ('40000000-0000-4000-8000-000000000002');
  exception when unique_violation then ok := true; end;
  assert ok, 'admin: one pending conversion invite per entry';
  update public.queue_conversion_invites set status='revoked' where id='50000000-0000-4000-8000-000000000001';
  insert into public.queue_conversion_invites (waitlist_entry_id, invited_by) values ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-0000000000a1');
  raise notice 'PASS step5 admin';
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ declare ok boolean; begin
  ok := false; begin perform count(*) from public.tenants; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot select tenants';
  ok := false; begin perform count(*) from public.queue_conversion_invites; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot select conversion invites';
  ok := false; begin perform count(*) from public.tenant_documents; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot select tenant_documents';
  assert (select count(*) from storage.objects where bucket_id='tenant-documents') = 0, 'anon: sees no tenant objects';
  raise notice 'PASS step5 anon';
end $$;

-- ===========================================================================
-- STEP 7: listing content, property_photos, property-photos bucket
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  update public.properties set description='Staff wrote this.', listing_headline='Bright 2-bed', amenities='{borehole_water,parking}', furnishing='semi_furnished', bathrooms=2, size_sqm=85, available_from=current_date
   where id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'staff: edits listing content on a listed property';
  update public.properties set description='Staff wrote this too.' where id='20000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count; assert n = 1, 'staff: edits listing content on a submitted property';
  ok := false;
  begin update public.properties set maintenance_threshold_ngn=1 where id='20000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'staff: cannot change the maintenance limit';
  ok := false;
  begin update public.properties set listed_at=now() where id='20000000-0000-4000-8000-000000000002';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'staff: cannot change listed_at';
  ok := false;
  begin update public.properties set status='listed' where id='20000000-0000-4000-8000-000000000002';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'staff: cannot publish (status is admin/service only)';
  ok := false;
  begin update public.properties set amenities='{jacuzzi}' where id='20000000-0000-4000-8000-000000000001';
  exception when check_violation then ok := true; end;
  assert ok, 'amenities outside the fixed list are rejected';
  insert into public.property_photos (property_id, storage_path, sort_order, uploaded_by)
  values ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/c.jpg',1,'10000000-0000-4000-8000-0000000000a2');
  update public.property_photos set caption='Living room' where storage_path='20000000-0000-4000-8000-000000000001/c.jpg';
  get diagnostics n = row_count; assert n = 1, 'staff: captions a photo';
  assert (select count(*) from public.property_photos where property_id::text like '20000000-%') = 3, 'staff: sees all photos';
  insert into storage.objects (bucket_id, name) values ('property-photos','20000000-0000-4000-8000-000000000001/c.jpg');
  -- (storage.objects DELETE cannot be exercised by direct SQL: storage.protect_delete()
  --  only allows the Storage API. The staff delete policy is covered by the admin
  --  "Delete photo" button, which calls storage.remove() through the API.)
  delete from public.property_photos where storage_path='20000000-0000-4000-8000-000000000001/c.jpg';
  get diagnostics n = row_count; assert n = 1, 'staff: deletes a photo row';
  ok := false;
  begin insert into public.property_photos (property_id, storage_path) values ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002/wrong.jpg');
  exception when check_violation then ok := true; end;
  assert ok, 'property_photos: path must be under the property folder';
  raise notice 'PASS step7 staff: listing content + photos, nothing else';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  assert (select count(*) from public.property_photos where property_id='20000000-0000-4000-8000-000000000001') = 1, 'landlord: reads own property photos';
  assert (select count(*) from public.property_photos where property_id='20000000-0000-4000-8000-000000000002') = 0, 'landlord: cannot read other landlord photos';
  assert (select description from public.properties where id='20000000-0000-4000-8000-000000000001') = 'Staff wrote this.', 'landlord: reads own listing content';
  ok := false;
  begin update public.properties set description='mine' where id='20000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot write listing content (listed property)';
  ok := false;
  begin update public.properties set listing_headline='mine' where address like '3 New St%';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot write listing content (submitted property)';
  ok := false;
  begin insert into public.properties (landlord_id, address, bedrooms, target_annual_rent, description) values ('10000000-0000-4000-8000-0000000000a3','9 Listing St',1,700000,'my copy');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot insert a property with listing content';
  ok := false;
  begin insert into public.property_photos (property_id, storage_path) values ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/l.jpg');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot insert photos';
  update public.property_photos set caption='x' where property_id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 0, 'landlord: cannot update photos';
  delete from public.property_photos where property_id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 0, 'landlord: cannot delete photos';
  assert (select count(*) from storage.objects where bucket_id='property-photos' and name like '20000000-0000-4000-8000-000000000001/%') = 2, 'landlord: reads own property photo objects (fixture + staff upload)';
  assert (select count(*) from storage.objects where bucket_id='property-photos' and name like '20000000-0000-4000-8000-000000000002/%') = 0, 'landlord: cannot read other property photo objects';
  ok := false;
  begin insert into storage.objects (bucket_id, name) values ('property-photos','20000000-0000-4000-8000-000000000001/l.jpg');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'landlord: cannot upload photos';
  raise notice 'PASS step7 landlord: reads own listing, writes nothing';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a7","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  assert public.is_verified_tenant(), 'verified tenant: helper';
  assert (select count(*) from public.properties where id::text like '20000000-%') = 1, 'verified tenant: sees only listed properties';
  assert (select status from public.properties where id::text like '20000000-%') = 'listed', 'verified tenant: the visible one is listed';
  assert (select count(*) from public.property_photos where property_id='20000000-0000-4000-8000-000000000001') = 1, 'verified tenant: reads listed property photos';
  assert (select count(*) from public.property_photos where property_id='20000000-0000-4000-8000-000000000002') = 0, 'verified tenant: cannot read unlisted property photos';
  assert (select count(*) from storage.objects where bucket_id='property-photos' and name like '20000000-0000-4000-8000-000000000001/%') = 2, 'verified tenant: reads listed photo objects';
  assert (select count(*) from storage.objects where bucket_id='property-photos' and name like '20000000-0000-4000-8000-000000000002/%') = 0, 'verified tenant: cannot read unlisted photo objects';
  update public.properties set description='x' where id='20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count; assert n = 0, 'verified tenant: cannot update properties';
  ok := false;
  begin insert into public.property_photos (property_id, storage_path) values ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/t.jpg');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'verified tenant: cannot insert photos';
  raise notice 'PASS step7 verified tenant: listed only, read only';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a8","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert not public.is_verified_tenant(), 'unverified tenant: helper';
  assert (select count(*) from public.properties) = 0, 'unverified tenant: sees no properties';
  assert (select count(*) from public.property_photos) = 0, 'unverified tenant: sees no photos';
  assert (select count(*) from storage.objects where bucket_id='property-photos') = 0, 'unverified tenant: sees no photo objects';
  raise notice 'PASS step7 unverified tenant sees nothing';
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ declare ok boolean; begin
  ok := false; begin perform count(*) from public.property_photos; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon: cannot select property_photos';
  assert (select count(*) from storage.objects where bucket_id='property-photos') = 0, 'anon: sees no photo objects';
  raise notice 'PASS step7 anon';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; ok boolean; begin
  -- p2 has a photo and rent but (after staff) a description; strip it to prove the rule.
  update public.properties set description=null where id='20000000-0000-4000-8000-000000000002';
  ok := false;
  begin update public.properties set status='listed' where id='20000000-0000-4000-8000-000000000002';
  exception when check_violation then ok := true; end;
  assert ok, 'admin: cannot publish without a description';
  update public.properties set description='Admin description' where id='20000000-0000-4000-8000-000000000002';
  delete from public.property_photos where property_id='20000000-0000-4000-8000-000000000002';
  ok := false;
  begin update public.properties set status='listed' where id='20000000-0000-4000-8000-000000000002';
  exception when check_violation then ok := true; end;
  assert ok, 'admin: cannot publish without a photo';
  insert into public.property_photos (property_id, storage_path) values ('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002/b.jpg');
  update public.properties set status='listed' where id='20000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count; assert n = 1, 'admin: publishes once requirements are met';
  assert (select listed_at from public.properties where id='20000000-0000-4000-8000-000000000002') is not null, 'listed_at set on publish';
  update public.properties set status='under_inspection' where id='20000000-0000-4000-8000-000000000002';
  assert (select listed_at from public.properties where id='20000000-0000-4000-8000-000000000002') is null, 'listed_at cleared on unpublish';
  assert (select count(*) from public.profiles where 'landlord' = any(role_tags) and id::text like '10000000-%') >= 2, 'admin: still reads landlord profiles';
  raise notice 'PASS step7 admin: publish rules + listed_at';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.profiles where id::text like '10000000-%' and 'landlord' = any(role_tags)) >= 2, 'staff: reads landlord profiles (names for the properties list)';
  assert (select count(*) from public.profiles where id::text like '10000000-%' and 'admin' = any(role_tags)) = 0, 'staff: still cannot read admin profiles';
  raise notice 'PASS step7 staff: landlord-profile read is narrow';
end $$;

reset role;
rollback;
\echo ALL RLS CHECKS PASSED

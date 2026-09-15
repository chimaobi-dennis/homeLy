-- HomeLy · migration 0010 (Step 3, fix A2)
-- Once a property has moved past `submitted` (under_inspection, listed, or
-- rejected and not yet resubmitted), the landlord can no longer change the
-- inspection-linked columns: address, city, bedrooms, target_annual_rent.
-- maintenance_threshold_ngn is NOT inspection-linked and stays editable.
--
-- The only landlord path that changes those columns afterwards is the explicit
-- resubmit action (rejected → submitted), which runs with the service role in
-- one atomic update after verifying ownership — so it is never a quiet edit.
-- Admin / service role are unaffected (is_privileged_writer short-circuits).

create or replace function public.guard_property_protected_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'submitted' then
      raise exception 'properties.status can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.rejection_reason is not null then
      raise exception 'properties.rejection_reason can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      raise exception 'properties.status can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.landlord_id is distinct from old.landlord_id then
      raise exception 'properties.landlord_id can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'properties.rejection_reason can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    -- Step 3 (A2): core details are frozen once the property is past `submitted`.
    if old.status <> 'submitted' and (
         new.address            is distinct from old.address
      or new.city               is distinct from old.city
      or new.bedrooms           is distinct from old.bedrooms
      or new.target_annual_rent is distinct from old.target_annual_rent
    ) then
      raise exception 'properties.address, city, bedrooms and target_annual_rent are locked while status is %; resubmit the property or contact HomeLy', old.status
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

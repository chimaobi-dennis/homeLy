-- HomeLy · migration 0008 (Step 2: landlord onboarding)
-- Review / agreement fields:
--   landlords.kyc_rejection_reason  — shown to the landlord when kyc_rejected
--   landlords.agreement_status      — management agreement e-signature state
--   properties.rejection_reason     — shown to the landlord when rejected
-- All three are protected columns: admin / service role only, like `status`.

create type public.landlord_agreement_status as enum (
  'not_sent',
  'pending_signature',
  'signed'
);

alter table public.landlords
  add column kyc_rejection_reason text,
  add column agreement_status public.landlord_agreement_status not null default 'not_sent';

comment on column public.landlords.kyc_rejection_reason is 'Plain-language reason shown to the landlord when status = kyc_rejected. Cleared on resubmission.';
comment on column public.landlords.agreement_status is 'Management agreement: not_sent → pending_signature (sent for e-signature) → signed. TODO(flowmono): webhook will set signed.';

alter table public.properties
  add column rejection_reason text;

comment on column public.properties.rejection_reason is 'Plain-language reason shown to the landlord when status = rejected. Cleared on resubmission.';

-- ---------------------------------------------------------------------------
-- Guard triggers: extend the protected-column set.
-- ---------------------------------------------------------------------------
create or replace function public.guard_landlord_protected_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'applied' then
      raise exception 'landlords.status can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.assigned_ops_contact is not null then
      raise exception 'landlords.assigned_ops_contact can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.kyc_rejection_reason is not null then
      raise exception 'landlords.kyc_rejection_reason can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.agreement_status <> 'not_sent' then
      raise exception 'landlords.agreement_status can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      raise exception 'landlords.status can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.assigned_ops_contact is distinct from old.assigned_ops_contact then
      raise exception 'landlords.assigned_ops_contact can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.kyc_rejection_reason is distinct from old.kyc_rejection_reason then
      raise exception 'landlords.kyc_rejection_reason can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.agreement_status is distinct from old.agreement_status then
      raise exception 'landlords.agreement_status can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

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
  end if;

  return new;
end;
$$;

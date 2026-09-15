-- HomeLy · migration 0011 (Step 3, fix A1)
-- A landlord_documents row may only reference a property owned by the SAME
-- landlord. The FK alone would accept any property id sent through the API.

create or replace function public.guard_landlord_document_property()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.property_id is not null and not exists (
    select 1 from public.properties p
     where p.id = new.property_id and p.landlord_id = new.landlord_id
  ) then
    raise exception 'landlord_documents.property_id must belong to the same landlord'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger landlord_documents_guard_property
  before insert or update on public.landlord_documents
  for each row execute function public.guard_landlord_document_property();

-- HomeLy · migration 0012 (Step 3, tenant waitlist Stage 1)
-- Duplicate-submission hygiene: one waitlist row per email address.
-- Case-insensitive (a unique index on lower(email)) because "Ada@x.com" and
-- "ada@x.com" are the same inbox; the app also lowercases before insert.
-- Deliberately NO uniqueness on whatsapp_number — shared household phones are
-- plausible. This is not the fake / multi-email abuse control from the PRD,
-- which is still an open decision.

drop index if exists public.waitlist_entries_email_idx;

create unique index waitlist_entries_email_unique_idx
  on public.waitlist_entries (lower(email));

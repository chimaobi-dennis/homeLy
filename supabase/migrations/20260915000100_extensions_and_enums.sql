-- HomeLy · migration 0001
-- Extensions and enum types shared by later migrations.
--
-- pgcrypto is enabled by default on Supabase (in the `extensions` schema); the
-- statement below is a no-op there but keeps the migration self-contained.
create extension if not exists pgcrypto with schema extensions;

-- Landlord KYC lifecycle.
create type public.landlord_status as enum (
  'applied',
  'kyc_pending',
  'kyc_verified',
  'kyc_rejected'
);

-- Property listing lifecycle.
create type public.property_status as enum (
  'submitted',
  'under_inspection',
  'listed',
  'rejected'
);

-- Staff invite lifecycle.
create type public.staff_invite_status as enum (
  'pending',
  'accepted',
  'revoked',
  'expired'
);

-- Tenant waitlist → active tenant conversion funnel.
create type public.waitlist_conversion_status as enum (
  'waitlist',
  'invited_to_convert',
  'kyc_pending',
  'active_queue'
);

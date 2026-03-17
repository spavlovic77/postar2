-- ============================================================
-- Postar Schema
-- Run this for a clean start. Drops everything and recreates.
-- ============================================================

-- ----------------------
-- Teardown
-- ----------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();
drop function if exists upsert_profile(uuid, text, text, text);

drop table if exists verification_codes cascade;
drop table if exists invitations cascade;
drop table if exists company_memberships cascade;
drop table if exists companies cascade;
drop table if exists pfs_verifications cascade;
drop table if exists profiles cascade;

drop type if exists verification_channel;
drop type if exists invitation_role;
drop type if exists membership_status;
drop type if exists company_role;

-- Delete all auth users for a clean start
delete from auth.sessions;
delete from auth.identities;
delete from auth.users;

-- ----------------------
-- Enums
-- ----------------------
create type company_role as enum ('company_admin', 'accountant');
create type membership_status as enum ('active', 'inactive');
create type invitation_role as enum ('super_admin', 'company_admin', 'accountant');
create type verification_channel as enum ('email', 'sms');

-- ----------------------
-- Profiles
-- ----------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  is_super_admin boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------
-- Upsert profile (called from app after login, no trigger needed)
-- ----------------------
create or replace function upsert_profile(
  user_id uuid,
  user_full_name text default null,
  user_avatar_url text default null,
  user_phone text default null
)
returns void as $$
begin
  insert into public.profiles (id, full_name, avatar_url, phone)
  values (user_id, user_full_name, user_avatar_url, user_phone)
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    phone = coalesce(excluded.phone, profiles.phone);
end;
$$ language plpgsql security definer set search_path = public;

-- ----------------------
-- Companies
-- ----------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  dic text not null unique check (dic ~ '^\d{10}$'),
  legal_name text,
  company_email text,
  company_phone text,
  pfs_created_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_companies_dic on companies (dic);

-- ----------------------
-- PFS Verifications (raw webhook log)
-- ----------------------
create table pfs_verifications (
  id uuid primary key default gen_random_uuid(),
  verification_token text not null,
  dic text not null check (dic ~ '^\d{10}$'),
  legal_name text,
  company_email text,
  company_phone text,
  pfs_created_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_pfs_verifications_token on pfs_verifications (verification_token);

-- ----------------------
-- Company Memberships
-- ----------------------
create table company_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role company_role not null,
  is_genesis boolean not null default false,
  status membership_status not null default 'active',
  invited_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index idx_company_memberships_user on company_memberships (user_id);
create index idx_company_memberships_company on company_memberships (company_id);

-- ----------------------
-- Invitations
-- ----------------------
create table invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role invitation_role not null,
  company_ids uuid[] not null default '{}',
  is_genesis boolean not null default false,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid references profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invitations_token on invitations (token);
create index idx_invitations_email on invitations (email);

-- ----------------------
-- Verification Codes (6-digit OTP for email/SMS)
-- ----------------------
create table verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  channel verification_channel not null,
  destination text not null,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_verification_codes_user on verification_codes (user_id);

-- ----------------------
-- Row Level Security
-- ----------------------
alter table profiles enable row level security;
alter table companies enable row level security;
alter table company_memberships enable row level security;
alter table invitations enable row level security;
alter table pfs_verifications enable row level security;
alter table verification_codes enable row level security;

-- Profiles
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Super admins can read all profiles"
  on profiles for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Companies
create policy "Members can view their companies"
  on companies for select
  using (
    exists (
      select 1 from company_memberships
      where company_memberships.company_id = companies.id
        and company_memberships.user_id = auth.uid()
        and company_memberships.status = 'active'
    )
  );

create policy "Super admins can view all companies"
  on companies for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

-- Company Memberships
create policy "Members can view memberships of their companies"
  on company_memberships for select
  using (
    exists (
      select 1 from company_memberships as my_membership
      where my_membership.company_id = company_memberships.company_id
        and my_membership.user_id = auth.uid()
        and my_membership.status = 'active'
    )
  );

create policy "Super admins can view all memberships"
  on company_memberships for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

-- Invitations
create policy "Inviters can view their invitations"
  on invitations for select
  using (invited_by = auth.uid());

create policy "Super admins can view all invitations"
  on invitations for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

-- PFS Verifications (no direct user access, only via service role)
create policy "No direct access to pfs_verifications"
  on pfs_verifications for select
  using (false);

-- Verification Codes (no direct user access, only via service role)
create policy "No direct access to verification_codes"
  on verification_codes for select
  using (false);

-- ============================================================
-- Seed Super Admin
-- After running this schema:
-- 1. Sign in to the app with Google/Apple
-- 2. Run: update profiles set is_super_admin = true
--    where id = (select id from auth.users limit 1);
-- ============================================================

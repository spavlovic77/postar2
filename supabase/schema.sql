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

drop table if exists system_settings cascade;
drop table if exists documents cascade;
drop table if exists department_memberships cascade;
drop table if exists departments cascade;
drop table if exists verification_codes cascade;
drop table if exists invitations cascade;
drop table if exists company_memberships cascade;
drop table if exists companies cascade;
drop table if exists pfs_verifications cascade;
drop table if exists profiles cascade;

drop function if exists create_audit_partition(text);
drop function if exists archive_audit_partition(text);
drop table if exists audit_logs cascade;

drop type if exists company_status;
drop type if exists document_direction;
drop type if exists document_status;
drop type if exists ion_ap_status;
drop type if exists audit_severity;
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
create type audit_severity as enum ('info', 'warning', 'error');
create type company_role as enum ('company_admin', 'operator', 'processor');
create type membership_status as enum ('active', 'inactive');
create type invitation_role as enum ('super_admin', 'company_admin', 'operator', 'processor');
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
  pfs_activation_link text,
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
-- System Settings (key-value, super admin editable)
-- ----------------------
create table system_settings (
  key text primary key,
  value text not null,
  description text,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Seed default settings
insert into system_settings (key, value, description) values
  ('resend_from_email', 'noreply@yourdomain.com', 'Sender email address for all outgoing emails'),
  ('pfs_webhook_secret', '', 'HMAC secret for PFS webhook signature verification (comma-separated for rotation)'),
  ('pfs_activation_link', '', 'URL sent to customers for PFS portal onboarding'),
  ('ion_ap_base_url', 'https://test.ion-ap.net', 'ion-AP API base URL'),
  ('ion_ap_api_token', '', 'ion-AP super admin API token'),
  ('twilio_phone_number', '', 'Twilio phone number for SMS OTP');

-- ----------------------
-- Companies
-- ----------------------
create type document_direction as enum ('received', 'sent');
create type document_status as enum ('pending', 'processing', 'new', 'read', 'assigned', 'processed', 'failed');
create type company_status as enum ('active', 'deactivated');
create type ion_ap_status as enum ('pending', 'active', 'error');

create table companies (
  id uuid primary key default gen_random_uuid(),
  dic text not null unique check (dic ~ '^\d{10}$'),
  legal_name text,
  company_email text,
  company_phone text,
  pfs_created_at timestamptz not null,
  status company_status not null default 'active',
  deactivated_at timestamptz,
  ion_ap_org_id integer,
  ion_ap_identifier_id integer,
  ion_ap_status ion_ap_status not null default 'pending',
  ion_ap_error text,
  ion_ap_activated_at timestamptz,
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
  roles company_role[] not null default '{}',
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
  roles invitation_role[] not null default '{}',
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
-- Departments (per company, optional nesting)
-- ----------------------
create table departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  parent_id uuid references departments(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create index idx_departments_company on departments (company_id);
create index idx_departments_parent on departments (parent_id);

-- ----------------------
-- Department Memberships (user ↔ department, many-to-many)
-- ----------------------
create table department_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, department_id)
);

create index idx_department_memberships_user on department_memberships (user_id);
create index idx_department_memberships_department on department_memberships (department_id);

-- ----------------------
-- Documents (received and sent Peppol invoices/credit notes)
-- ----------------------
create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  assigned_to_company_id uuid references companies(id) on delete set null,

  -- Direction and status
  direction document_direction not null,
  status document_status not null default 'pending',

  -- ion-AP transaction data
  ion_ap_transaction_id integer not null,
  transaction_uuid text,

  -- Document metadata
  document_type text,
  document_id text,
  sender_identifier text,
  receiver_identifier text,

  -- Content (XML stored in Vercel Blob)
  blob_url text,

  -- Retry tracking
  retry_count integer not null default 0,
  last_error text,
  last_retry_at timestamptz,

  -- Timestamps from ion-AP
  peppol_created_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_documents_company on documents (company_id);
create index idx_documents_assigned on documents (assigned_to_company_id);
create index idx_documents_direction on documents (direction, status);
create index idx_documents_ion_ap on documents (ion_ap_transaction_id);

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
-- Audit Logs (partitioned by month for easy archiving)
-- CEF format: CEF:0|Postar|Postar|1.0|{event_id}|{event_name}|{severity}|{extensions}
-- ----------------------
create table audit_logs (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- CEF fields
  event_id text not null,
  event_name text not null,
  severity audit_severity not null default 'info',

  -- Correlation
  actor_id uuid,
  actor_email text,
  company_id uuid,
  company_dic text,

  -- CEF extension fields
  source_ip text,
  user_agent text,
  details jsonb default '{}',

  -- CEF formatted string (pre-rendered for SIEM export)
  cef text not null,

  primary key (id, created_at)
) partition by range (created_at);

create index idx_audit_logs_actor on audit_logs (actor_id, created_at);
create index idx_audit_logs_company on audit_logs (company_id, created_at);
create index idx_audit_logs_company_dic on audit_logs (company_dic, created_at);
create index idx_audit_logs_event on audit_logs (event_id, created_at);

-- Function to create monthly partitions
-- Usage: select create_audit_partition('2026-03');
create or replace function create_audit_partition(month_str text)
returns void as $$
declare
  start_date date;
  end_date date;
  partition_name text;
begin
  start_date := (month_str || '-01')::date;
  end_date := start_date + interval '1 month';
  partition_name := 'audit_logs_' || to_char(start_date, 'YYYY_MM');

  execute format(
    'create table if not exists %I partition of audit_logs for values from (%L) to (%L)',
    partition_name, start_date, end_date
  );
end;
$$ language plpgsql;

-- Function to archive (detach) a monthly partition
-- Detaches it into a standalone table: audit_logs_YYYY_MM_archive
-- You can then export and drop it at your convenience.
-- Usage: select archive_audit_partition('2026-03');
create or replace function archive_audit_partition(month_str text)
returns text as $$
declare
  partition_name text;
  archive_name text;
begin
  partition_name := 'audit_logs_' || replace(month_str, '-', '_');
  archive_name := partition_name || '_archive';

  execute format('alter table audit_logs detach partition %I', partition_name);
  execute format('alter table %I rename to %I', partition_name, archive_name);

  return archive_name;
end;
$$ language plpgsql;

-- Create partitions for current month + next 6 months
do $$
declare
  m int;
begin
  for m in 0..6 loop
    perform create_audit_partition(to_char(now() + (m || ' months')::interval, 'YYYY-MM'));
  end loop;
end;
$$;

-- ----------------------
-- Row Level Security
-- ----------------------
alter table system_settings enable row level security;
alter table profiles enable row level security;
alter table companies enable row level security;
alter table company_memberships enable row level security;
alter table invitations enable row level security;
alter table pfs_verifications enable row level security;
alter table verification_codes enable row level security;
alter table documents enable row level security;
alter table departments enable row level security;
alter table department_memberships enable row level security;
alter table audit_logs enable row level security;

-- System Settings (super admin only)
create policy "Super admins can view system settings"
  on system_settings for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

create policy "Super admins can update system settings"
  on system_settings for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

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

-- Documents: visible to company members + super admins
create policy "Members can view documents of their companies"
  on documents for select
  using (
    exists (
      select 1 from company_memberships
      where (company_memberships.company_id = documents.company_id
             or company_memberships.company_id = documents.assigned_to_company_id)
        and company_memberships.user_id = auth.uid()
        and company_memberships.status = 'active'
    )
  );

create policy "Super admins can view all documents"
  on documents for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

-- Departments: visible to company members + super admins
create policy "Members can view departments of their companies"
  on departments for select
  using (
    exists (
      select 1 from company_memberships
      where company_memberships.company_id = departments.company_id
        and company_memberships.user_id = auth.uid()
        and company_memberships.status = 'active'
    )
  );

create policy "Super admins can view all departments"
  on departments for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

-- Department Memberships: visible to company members + super admins
create policy "Members can view department memberships of their companies"
  on department_memberships for select
  using (
    exists (
      select 1 from departments
      join company_memberships on company_memberships.company_id = departments.company_id
      where departments.id = department_memberships.department_id
        and company_memberships.user_id = auth.uid()
        and company_memberships.status = 'active'
    )
  );

create policy "Super admins can view all department memberships"
  on department_memberships for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

-- Audit Logs
create policy "Super admins can view all audit logs"
  on audit_logs for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

create policy "Members can view audit logs for their companies"
  on audit_logs for select
  using (
    audit_logs.company_id is not null
    and exists (
      select 1 from company_memberships
      where company_memberships.company_id = audit_logs.company_id
        and company_memberships.user_id = auth.uid()
        and company_memberships.status = 'active'
    )
  );

create policy "Users can view their own audit logs"
  on audit_logs for select
  using (actor_id = auth.uid());

-- ============================================================
-- Seed Super Admin
-- After running this schema:
-- 1. Sign in to the app with Google/Apple
-- 2. Run: update profiles set is_super_admin = true
--    where id = (select id from auth.users limit 1);
-- ============================================================

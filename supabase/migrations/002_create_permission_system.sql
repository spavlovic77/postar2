-- Enums
create type company_role as enum ('company_admin', 'accountant');
create type membership_status as enum ('active', 'inactive');
create type invitation_role as enum ('super_admin', 'company_admin', 'accountant');

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Companies (created from PFS webhook)
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

-- Company memberships
create table company_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role company_role not null,
  is_genesis boolean not null default false,
  status membership_status not null default 'active',
  invited_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index idx_company_memberships_user on company_memberships (user_id);
create index idx_company_memberships_company on company_memberships (company_id);

-- Invitations
create table invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role invitation_role not null,
  company_ids uuid[] not null default '{}',
  is_genesis boolean not null default false,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid references profiles(id),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invitations_token on invitations (token);
create index idx_invitations_email on invitations (email);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table profiles enable row level security;
alter table companies enable row level security;
alter table company_memberships enable row level security;
alter table invitations enable row level security;

-- Profiles: read own, super admins read all
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

-- Companies: visible to members + super admins
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

-- Company memberships: visible to members of the same company + super admins
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

-- Invitations: visible to inviter + super admins
create policy "Inviters can view their invitations"
  on invitations for select
  using (invited_by = auth.uid());

create policy "Super admins can view all invitations"
  on invitations for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_super_admin = true)
  );

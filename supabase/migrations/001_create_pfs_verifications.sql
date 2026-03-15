create table pfs_verifications (
  id uuid primary key default gen_random_uuid(),
  verification_token text not null,
  dic text not null check (dic ~ '^\d{10}$'),
  legal_name text,
  company_email text,
  company_phone text,
  pfs_created_at timestamptz not null,
  created_at timestamptz default now()
);

-- Index for idempotency lookups
create index idx_pfs_verifications_token on pfs_verifications (verification_token);

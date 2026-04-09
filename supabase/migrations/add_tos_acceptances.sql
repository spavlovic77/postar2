-- Audit trail of legal document acceptance during account activation
create table if not exists tos_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  vop_version text not null,
  privacy_version text not null,
  vop_downloaded_at timestamptz,
  privacy_downloaded_at timestamptz,
  source_ip text,
  user_agent text,
  accepted_at timestamptz not null default now()
);

create index if not exists idx_tos_acceptances_user on tos_acceptances (user_id, accepted_at);

alter table tos_acceptances enable row level security;

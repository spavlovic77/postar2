-- Single-use magic link tokens for one-click email auth
create table if not exists magic_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_to text not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_magic_links_token on magic_links (token);
create index if not exists idx_magic_links_user on magic_links (user_id);

alter table magic_links enable row level security;

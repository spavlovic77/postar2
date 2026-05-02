-- Stores Expo push tokens per (user, device) so the postar2 peppol-receive
-- worker can fan out push notifications to all devices of every active
-- company-level member of the receiving company.
--
-- One row per (user_id, expo_token) — re-installs / new devices add rows;
-- the mobile client upserts on every cold start so last_seen_at stays fresh.
-- Run alongside or after 2026_05_02_documents_paid.sql.

create table if not exists public.device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null
                  references auth.users(id) on delete cascade,
  expo_token    text not null,
  platform      text not null
                  check (platform in ('ios', 'android')),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (user_id, expo_token)
);

create index if not exists idx_device_tokens_user
  on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- Users may only see/insert/update/delete their own tokens. Server-side
-- (the peppol-receive worker) uses the service-role key, which bypasses RLS.

drop policy if exists device_tokens_select_own on public.device_tokens;
drop policy if exists device_tokens_insert_own on public.device_tokens;
drop policy if exists device_tokens_update_own on public.device_tokens;
drop policy if exists device_tokens_delete_own on public.device_tokens;

create policy device_tokens_select_own on public.device_tokens
  for select to authenticated
  using (user_id = auth.uid());

create policy device_tokens_insert_own on public.device_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

create policy device_tokens_update_own on public.device_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy device_tokens_delete_own on public.device_tokens
  for delete to authenticated
  using (user_id = auth.uid());

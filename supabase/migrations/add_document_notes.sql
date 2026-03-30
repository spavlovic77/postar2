-- Add document_notes table for comment threads on documents
create table if not exists document_notes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  note text not null,
  type text not null default 'comment',
  created_at timestamptz not null default now()
);

create index if not exists idx_document_notes_document on document_notes (document_id, created_at);

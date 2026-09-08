-- User presence — tracks which card each active user has open
-- Rows are upserted on a heartbeat every 30s; stale after 60s

create table if not exists public.user_presence (
  user_id        uuid        primary key references auth.users(id) on delete cascade,
  user_email     text        not null default '',
  active_card_id text,
  last_seen_at   timestamptz not null default now()
);

-- Index for the stale-row filter on GET
create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen_at);

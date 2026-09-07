-- AI Usage Log
-- Tracks every OpenAI API call made by the app, per user and feature.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.ai_usage_log (
  id              bigserial primary key,
  user_id         uuid          references auth.users(id) on delete set null,
  feature         text          not null,
  model           text          not null,
  input_tokens    integer       not null default 0,
  output_tokens   integer       not null default 0,
  estimated_usd   numeric(10,8) not null default 0,
  created_at      timestamptz   not null default now()
);

-- Index for the per-user dashboard query
create index if not exists ai_usage_log_user_created
  on public.ai_usage_log (user_id, created_at desc);

-- Row-level security: users can only see their own rows
alter table public.ai_usage_log enable row level security;

create policy "Users read own usage"
  on public.ai_usage_log
  for select
  using (auth.uid() = user_id);

-- Service role bypasses RLS, so the server-side logger can insert freely.
-- No insert policy needed — supabaseAdmin uses the service role key.

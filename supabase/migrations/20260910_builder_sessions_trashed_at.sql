-- Add trashed_at to builder_sessions so trash is org-wide (not per-browser localStorage)
-- Run in Supabase Dashboard → SQL Editor → New query.

alter table public.builder_sessions
  add column if not exists trashed_at timestamptz default null;

-- Index for fast filtering of active vs trashed sessions
create index if not exists builder_sessions_trashed_at_idx
  on public.builder_sessions (trashed_at)
  where trashed_at is null;

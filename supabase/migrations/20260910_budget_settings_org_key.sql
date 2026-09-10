-- Fix user_budget_settings to support a text org key ("org")
-- The original schema used uuid FK → auth.users, which blocked the global "org" row.

-- 1. Drop the existing table (no real data — only "org" key was ever intended)
drop table if exists public.user_budget_settings;

-- 2. Recreate with text primary key — no FK so "org" is a valid key
create table public.user_budget_settings (
  user_id              text         primary key,
  monthly_call_budget  integer      not null default 200,
  updated_at           timestamptz  not null default now()
);

alter table public.user_budget_settings enable row level security;

-- Only the service role (admin client) manages this table
create policy "Service role only"
  on public.user_budget_settings
  for all
  using (false)
  with check (false);

-- Seed the org row so reads always return something
insert into public.user_budget_settings (user_id, monthly_call_budget)
values ('org', 200)
on conflict (user_id) do nothing;

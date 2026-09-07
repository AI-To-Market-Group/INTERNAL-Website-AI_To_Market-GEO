-- User Budget Settings
-- Stores each user's monthly AI call budget for the v2 guard system.
-- Run in Supabase Dashboard → SQL Editor.

create table if not exists public.user_budget_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  monthly_call_budget  integer      not null default 200,
  updated_at           timestamptz  not null default now()
);

alter table public.user_budget_settings enable row level security;

create policy "Users manage own budget"
  on public.user_budget_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

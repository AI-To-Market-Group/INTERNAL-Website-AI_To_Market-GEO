-- Team members & roles
-- role: 'admin' | 'editor'
-- Run in Supabase Dashboard → SQL Editor → New query

create table if not exists public.team_members (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  full_name   text,
  role        text        not null default 'editor' check (role in ('admin', 'editor')),
  invited_by  uuid        references auth.users(id),
  created_at  timestamptz not null default now()
);

-- Seed existing admins by email
insert into public.team_members (id, email, role)
select id, email, 'admin'
from auth.users
where email in ('manoj@aitomarketgroup.com', 'neha@aitomarketgroup.com')
on conflict (id) do update set role = 'admin';

-- Service role only — no RLS needed (admin-only API)

-- Activity audit log — every meaningful user action
create table if not exists public.activity_logs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete set null,
  user_email   text        not null default '',
  action       text        not null,
  entity_type  text,
  entity_id    text,
  entity_title text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists activity_logs_user_idx      on public.activity_logs (user_id, created_at desc);
create index if not exists activity_logs_created_idx   on public.activity_logs (created_at desc);
create index if not exists activity_logs_action_idx    on public.activity_logs (action);

-- Add word_count_targets to brand_voice so quality thresholds are controllable from the UI
-- Run in Supabase Dashboard → SQL Editor → New query.

alter table public.brand_voice
  add column if not exists word_count_targets jsonb not null default '{
    "introduction": 100,
    "stats": 100,
    "faq": 200,
    "how_to": 150,
    "section": 150,
    "conclusion": 80
  }';

-- Back-fill existing row
update public.brand_voice
set word_count_targets = '{
  "introduction": 100,
  "stats": 100,
  "faq": 200,
  "how_to": 150,
  "section": 150,
  "conclusion": 80
}'::jsonb
where word_count_targets = '{}'::jsonb or word_count_targets is null;

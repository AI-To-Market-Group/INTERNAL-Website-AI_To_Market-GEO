-- Brand Voice
-- One row per workspace (currently single-workspace). Seeded with the
-- hardcoded defaults from src/lib/brand-voice.ts so generation quality
-- is identical on first load. Editable from the Brand voice settings page.
-- Run in Supabase Dashboard → SQL Editor → New query.

create table if not exists public.brand_voice (
  id                bigserial primary key,
  brand_description text          not null,
  audience          text          not null,
  tone              text[]        not null default '{}',
  preferred_style   text[]        not null default '{}',
  forbidden_phrases text[]        not null default '{}',
  guardrails        jsonb         not null default '[]',
  updated_at        timestamptz   not null default now()
);

-- Seed with current hardcoded values
insert into public.brand_voice (
  brand_description, audience, tone, preferred_style, forbidden_phrases, guardrails
) values (
  'Specialist AI strategy and implementation consultancy helping enterprise and mid-market businesses deploy AI across marketing, sales, and supply chain — founded by practitioners, not theorists.',
  'CMOs, heads of marketing, VP Sales, revenue operations leads, supply chain managers, and digital transformation directors at mid-to-large companies. They understand their business problems — write past generic AI hype and vendor promises.',
  array[
    'Practitioner-to-practitioner — like a senior consultant who has shipped real AI implementations explaining what actually works, not a vendor pitch.',
    'Specific and commercial — real outcomes, real timelines, real tradeoffs.',
    'Sceptical of AI hype, honest about limitations. Acknowledge failure modes and change management challenges.',
    'Decisive and direct. No hedge-everything corporate speak.'
  ],
  array[
    'Name specific AI tools, models, and platforms — Claude, GPT-4o, Perplexity, n8n, Make, Salesforce Einstein — not vague ''AI solutions''.',
    'Active voice. Real subjects doing real things.',
    'Real business outcomes with numbers: ''reduced MQL-to-SQL cycle by 40%'' not ''improved efficiency''.',
    'Client scenarios: ''a CMO at a €200M retail brand'' or ''a head of sales ops at a B2B SaaS company'' not ''business leaders''.',
    'Acknowledge the messy reality — AI implementations overrun budgets, change management is slow, adoption takes longer than promised.',
    'Skip definition openers like ''AI is transforming X'' — start with a result, a failure mode, or a specific business scenario instead.'
  ],
  array[
    'in today''s fast-paced world', 'in today''s digital age', 'leverage', 'synergize',
    'holistic approach', 'game-changing', 'revolutionary', 'cutting-edge', 'best-in-class',
    'world-class', 'next-generation', 'transformative', 'needless to say',
    'it''s important to note', 'as we can see', 'in order to', 'utilize',
    'robust solution', 'delve into', 'harness the power of', 'unlock your potential',
    'at the forefront', 'seamlessly'
  ],
  '[
    {"label": "Never claim a number without a source", "active": true},
    {"label": "No product mentions before the final section", "active": true},
    {"label": "Flag any sentence over 30 words", "active": false}
  ]'::jsonb
);

-- Service role can read/write (no RLS needed — admin-only settings page)

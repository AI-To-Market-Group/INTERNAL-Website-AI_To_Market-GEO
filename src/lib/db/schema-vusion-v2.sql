-- =============================================================
--  Vusion Content Creation — v2 schema additions
--  Run after schema.sql in: Supabase Dashboard → SQL Editor
--
--  Scope: 2-3 internal Vusion users, small brand corpus.
--  Stack: Supabase (Postgres + Auth) + SEMrush API + LLMs with prompt caching.
--
--  Decision: NO RAG / NO pgvector at this stage.
--  Brand corpus is small enough (~5-10 docs) to inject in full into the
--  system prompt with Anthropic prompt caching. Revisit pgvector later if
--  Vusion accumulates hundreds of validated pieces of content.
-- =============================================================


-- -------------------------------------------------------------
--  1. vusion_brand_documents  (full brand docs — no chunking)
--
--  Each row = one full document (Tone of Voice, Brand Guidelines,
--  inspiration phrases, validated press releases, etc.).
--  At generation time we load all rows where is_active = TRUE and
--  language matches (or NULL = language-agnostic), then inject the
--  whole `content` into the system prompt with prompt caching.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vusion_brand_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key         TEXT NOT NULL,              -- stable key, e.g. "tone-of-voice", "brand-guidelines"
  doc_type        TEXT NOT NULL,              -- 'tone_of_voice' | 'brand_guidelines' | 'inspiration' | 'press_release' | 'positioning'
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,              -- full document text (markdown / plain)
  language        TEXT,                       -- 'fr' | 'en' | ...  NULL = language-agnostic
  version         INTEGER NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB DEFAULT '{}'::jsonb,  -- source URL, last reviewer, etc.
  updated_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_doc_key_version
  ON vusion_brand_documents(doc_key, version);
CREATE INDEX IF NOT EXISTS idx_brand_doc_active
  ON vusion_brand_documents(doc_type, language) WHERE is_active = TRUE;


-- -------------------------------------------------------------
--  2. vusion_country_rules  (compliance + cultural sensitivities)
--
--  Indexed by COUNTRY, not by language (US != UK even if both 'en').
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vusion_country_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  TEXT NOT NULL,                -- ISO 3166-1 alpha-2, or '*' = all
  topic         TEXT NOT NULL,                -- 'greenwashing' | 'personalization' | 'pricing' | ...
  rule_type     TEXT NOT NULL,                -- 'forbidden_claim' | 'sensitive_topic' | 'required_disclaimer' | 'preferred_framing'
  pattern       TEXT NOT NULL,                -- trigger phrase or concept
  guidance      TEXT NOT NULL,                -- what to do instead
  evidence_required BOOLEAN DEFAULT FALSE,    -- if TRUE, allowed only when backed by proof_source
  proof_source  TEXT,                         -- URL/doc proving the claim
  severity      TEXT NOT NULL DEFAULT 'block',-- 'block' | 'warn' | 'info'
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_country_rules_lookup
  ON vusion_country_rules(country_code, topic) WHERE is_active = TRUE;


-- -------------------------------------------------------------
--  3. vusion_translation_glossary
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vusion_translation_glossary (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_term     TEXT NOT NULL,
  source_language TEXT NOT NULL,
  translations    JSONB NOT NULL,             -- { "de": "...", "it": "...", ... }
  context         TEXT,
  do_not_translate BOOLEAN DEFAULT FALSE,     -- e.g. "VusionCloud"
  category        TEXT,                       -- 'product' | 'feature' | 'concept' | 'legal'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_glossary_term
  ON vusion_translation_glossary(LOWER(source_term), source_language);


-- -------------------------------------------------------------
--  4. vusion_content_runs  (one generation job)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vusion_content_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  brief           JSONB NOT NULL,
  support_type    TEXT NOT NULL,              -- 'blog' | 'web_page' | 'press_release' | 'social_post' | 'email' | ...
  target_countries TEXT[] NOT NULL,
  target_languages TEXT[] NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
                                              -- 'pending' | 'generating' | 'quality_check' | 'needs_review' | 'approved' | 'rejected' | 'failed'
  llm_model       TEXT,
  brand_doc_ids   UUID[],                     -- which brand_documents were injected (audit)
  semrush_keywords_ids UUID[],
  total_cost_usd  NUMERIC(10,6),
  total_latency_ms INTEGER,
  cache_hit_ratio NUMERIC(5,4),               -- prompt cache effectiveness
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_runs_user_status
  ON vusion_content_runs(user_id, status, created_at DESC);


-- -------------------------------------------------------------
--  5. vusion_content_versions
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vusion_content_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES vusion_content_runs(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  language        TEXT NOT NULL,
  country_code    TEXT NOT NULL,
  content         TEXT NOT NULL,
  content_html    TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,

  seo_score       NUMERIC(5,2),               -- SEMrush-derived 0-100
  geo_score       NUMERIC(5,2),               -- LLM citation rate 0-100 (cf. geo_runs)
  brand_voice_score NUMERIC(5,2),             -- LLM-as-judge vs Tone of Voice doc
  compliance_status TEXT NOT NULL DEFAULT 'pending',
                                              -- 'pass' | 'warn' | 'fail' | 'pending'
  compliance_findings JSONB,

  status          TEXT NOT NULL DEFAULT 'draft',
                                              -- 'draft' | 'approved' | 'rejected' | 'superseded'
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  edited_by       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_run_lang_country_num
  ON vusion_content_versions(run_id, language, country_code, version_number);
CREATE INDEX IF NOT EXISTS idx_versions_status
  ON vusion_content_versions(status, created_at DESC);


-- -------------------------------------------------------------
--  6. vusion_semrush_keywords  (cached SEMrush keyword research)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vusion_semrush_keywords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword         TEXT NOT NULL,
  country_code    TEXT NOT NULL,              -- SEMrush db: 'us', 'uk', 'fr', 'de', ...
  search_volume   INTEGER,
  keyword_difficulty NUMERIC(5,2),
  cpc_usd         NUMERIC(10,4),
  competition     NUMERIC(5,4),
  intent          TEXT,                       -- 'informational' | 'navigational' | 'commercial' | 'transactional'
  serp_features   TEXT[],
  trend           JSONB,
  related_keywords JSONB,
  raw_response    JSONB,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_semrush_kw_country
  ON vusion_semrush_keywords(LOWER(keyword), country_code);
CREATE INDEX IF NOT EXISTS idx_semrush_kw_expires
  ON vusion_semrush_keywords(expires_at);


-- -------------------------------------------------------------
--  7. vusion_semrush_serp  (cached SERP snapshots)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vusion_semrush_serp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword         TEXT NOT NULL,
  country_code    TEXT NOT NULL,
  top_results     JSONB NOT NULL,             -- [{ position, url, title, snippet, domain }]
  vusion_position INTEGER,
  competitors     TEXT[],
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_semrush_serp_kw_country
  ON vusion_semrush_serp(LOWER(keyword), country_code);


-- -------------------------------------------------------------
--  8. vusion_quality_findings  (denormalized findings for review UI)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vusion_quality_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      UUID NOT NULL REFERENCES vusion_content_versions(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,              -- 'compliance' | 'seo' | 'geo' | 'brand_voice' | 'language'
  severity        TEXT NOT NULL,              -- 'block' | 'warn' | 'info'
  rule_id         UUID,                       -- FK to country_rules.id when applicable
  message         TEXT NOT NULL,
  snippet         TEXT,
  suggested_fix   TEXT,
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by     TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_version
  ON vusion_quality_findings(version_id, severity);


-- -------------------------------------------------------------
--  9. RLS — restrict to authenticated Vusion users (shared workspace)
-- -------------------------------------------------------------
ALTER TABLE vusion_brand_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vusion_country_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vusion_translation_glossary ENABLE ROW LEVEL SECURITY;
ALTER TABLE vusion_content_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vusion_content_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vusion_semrush_keywords    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vusion_semrush_serp        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vusion_quality_findings    ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "auth all brand_documents" ON vusion_brand_documents     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth all country_rules"   ON vusion_country_rules       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth all glossary"        ON vusion_translation_glossary FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth all content_runs"    ON vusion_content_runs        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth all versions"        ON vusion_content_versions    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth all semrush_kw"      ON vusion_semrush_keywords    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth all semrush_serp"    ON vusion_semrush_serp        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth all findings"        ON vusion_quality_findings    FOR ALL TO authenticated USING (true) WITH CHECK (true);

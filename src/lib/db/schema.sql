-- =============================================================
--  AI To Market — full Supabase schema
--  Run this once in: Supabase Dashboard → SQL Editor → New query
--
--  Last synced: 2026-06-09
--  Source of truth: src/lib/db/*.ts
-- =============================================================


-- -------------------------------------------------------------
--  1. builder_sessions
--
--  User-scoped: (user_id, opportunity_id) is the logical key.
--  `id` is a surrogate PK; opportunity_id can be null for
--  sessions created without an opportunity (free-form drafts).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS builder_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 TEXT NOT NULL,
  opportunity_id          TEXT,
  topic_title             TEXT NOT NULL,
  outline                 JSONB,
  draft                   JSONB,
  wp_metadata             JSONB,
  opportunity_context     JSONB,
  current_step            SMALLINT DEFAULT 1,
  sent_to_wordpress_at    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_builder_sessions_user_opportunity
  ON builder_sessions(user_id, opportunity_id);


-- -------------------------------------------------------------
--  2. ga4_connections  (encrypted tokens stored by app layer)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ga4_connections (
  user_id                     TEXT PRIMARY KEY,
  ga_property_id              TEXT NOT NULL,
  ga_property_display_name    TEXT,
  access_token                TEXT NOT NULL,
  refresh_token               TEXT NOT NULL,
  token_expiry                BIGINT NOT NULL,
  created_at                  BIGINT NOT NULL,
  updated_at                  BIGINT NOT NULL
);


-- -------------------------------------------------------------
--  3. user_settings  (per-user keywords and seasonal dates)
--
--  Replaces the old global `settings (key, value)` table.
--  Each user has one row; seed_keywords and seasonal_dates are
--  updated in-place via upsert.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  user_id         TEXT PRIMARY KEY,
  seed_keywords   TEXT[]  NOT NULL DEFAULT '{}',
  seasonal_dates  JSONB   NOT NULL DEFAULT '[]'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -------------------------------------------------------------
--  4. rate_limits  (global rate limiting across serverless instances)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  key       TEXT PRIMARY KEY,
  count     INTEGER NOT NULL DEFAULT 0,
  reset_at  TIMESTAMPTZ NOT NULL
);


-- -------------------------------------------------------------
--  5. geo_history  (GEO benchmark run history)
--
--  User-scoped: (user_id, run_id) is the unique key.
--  Replaces the old `geo_runs` table (no user_id).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS geo_history (
  user_id                   TEXT NOT NULL,
  run_id                    TEXT NOT NULL,
  company_name              TEXT,
  main_url                  TEXT,
  prompts                   JSONB NOT NULL,
  results                   JSONB NOT NULL,
  model                     TEXT,
  target_llms               TEXT[],
  avg_citation_rate         NUMERIC(5,2),
  total_estimated_cost_usd  NUMERIC(10,6),
  total_latency_ms          INTEGER,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_geo_history_user_created
  ON geo_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geo_history_company
  ON geo_history(company_name);


-- -------------------------------------------------------------
--  6. insights  (content forge — user-scoped articles)
--
--  Each row belongs to one user (user_id = Supabase auth uid).
--  All dynamic metadata (heroImage, category, dateISO, excerpt,
--  parentSlug, cmsMetadata, …) lives in the `metadata` JSONB
--  column so we can extend it without schema migrations.
--  `content` stores the full markdown body.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'blog',
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_insights_user_slug
  ON insights(user_id, slug);
CREATE INDEX IF NOT EXISTS idx_insights_user_created
  ON insights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_user_type
  ON insights(user_id, type);


-- -------------------------------------------------------------
--  7. Storage bucket: insights-images
--
--  Public bucket used by /api/insights/upload-image.
--  Files are stored at path: {user_id}/{timestamp}-{random}.ext
--  The INSERT is skipped silently if the bucket already exists.
-- -------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('insights-images', 'insights-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload into their own folder (user_id/*)
CREATE POLICY IF NOT EXISTS "Auth users can upload their images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'insights-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read on all objects in this bucket
CREATE POLICY IF NOT EXISTS "Public read on insights-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'insights-images');

-- Allow authenticated users to delete their own uploads
CREATE POLICY IF NOT EXISTS "Auth users can delete their images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'insights-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

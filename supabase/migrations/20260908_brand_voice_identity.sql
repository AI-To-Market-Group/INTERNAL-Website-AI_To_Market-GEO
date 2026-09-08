-- Add company identity fields to brand_voice table
-- Run in Supabase Dashboard → SQL Editor → New query

ALTER TABLE public.brand_voice
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT 'AI To Market',
  ADD COLUMN IF NOT EXISTS website      text NOT NULL DEFAULT 'https://aitomarketgroup.com/';

-- Seed identity values on the existing row
UPDATE public.brand_voice
SET
  company_name = 'AI To Market',
  website      = 'https://aitomarketgroup.com/',
  -- Add wrong-name variants to forbidden_phrases if not already present
  forbidden_phrases = CASE
    WHEN NOT ('AITOM' = ANY(forbidden_phrases))
    THEN array_prepend('AI2M', array_prepend('AITOM', forbidden_phrases))
    ELSE forbidden_phrases
  END;

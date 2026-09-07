// --- Source types (Digital Market Radar spec)
export type OpportunitySource = "date" | "trend" | "gap";
export type PriorityLevel = "haute" | "moyenne" | "basse";
export type ConfidenceLevel = "strong" | "good" | "medium" | "low";
export type DeltaLabel = "nouveau" | "en_hausse" | "expire_bientot" | null;

// --- Legacy / API compatibility (backend may still send these)
export type OpportunityType = "SEASONAL" | "TREND" | "SEO_GAP";
export type SEOSubtype =
  | "STRIKING_DISTANCE"
  | "ZOMBIE_CONTENT"
  | "CONTENT_GAP";
export type OpportunityStatus =
  | "new"
  | "pending"
  | "in_progress"
  | "completed"
  | "dismissed";

export interface OpportunityMetrics {
  search_volume: number | null;
  keyword_difficulty: number | null;
  current_position: number | null;
  target_position: number | null;
  trend_percentage: number | null;
  last_updated_days: number | null;
  days_until_event: number | null;
  event_name: string | null;
  category: string | null;
  // Drawer / detail
  topic_quality?: number | null;
  coverage_potential?: number | null;
  confidence?: ConfidenceLevel | null;
}

export interface Opportunity {
  id: string;
  title: string;
  // New spec fields (optional for API compatibility; normalizer fills from legacy)
  theme?: string;
  intents?: string[];
  sources?: OpportunitySource[];
  score?: number;
  priority?: PriorityLevel;
  content_brief?: string;
  delta?: DeltaLabel | null;
  justification_signals?: string[];
  competitor_articles?: Array<{ source: string; title: string; link: string }>;
  // Legacy/API
  type?: OpportunityType;
  subtype?: SEOSubtype | null;
  driver_label?: string;
  impact_score?: number;
  metrics?: OpportunityMetrics;
  tags?: string[];
  action_label?: string;
  status?: OpportunityStatus;
  created_at?: string;
  related_article_url?: string | null;
  /** For date opportunities: name of the special date (e.g. Halloween, Back to school) */
  active_season?: string | null;
  /** For date opportunities: unique key per event (e.g. "Christmas_2026-12-25") for grouping */
  date_event_key?: string | null;
}

export interface BigDate {
  id: string;
  name: string;
  date_start: string; // Start date (YYYY-MM-DD)
  date_end?: string; // End date (YYYY-MM-DD), optional
  is_active: boolean;
  keywords: string[];
  /** AI To Market interest for this date (shown on hover). */
  description?: string;
}

export interface UserSettings {
  seed_keywords: string[];
  big_dates: BigDate[];
}

export interface RadarWeekMeta {
  week_label: string; // e.g. "Week of 30 Jan → 5 Feb"
  timezone: string; // e.g. "Europe/Paris"
  last_updated?: string; // ISO 8601
}

export interface OpportunitiesResponse {
  meta: {
    total_opportunities: number;
    last_updated: string;
    week?: RadarWeekMeta;
    filters_applied?: {
      seed_keywords: string[];
      exclude_recent_articles_days?: number;
    };
    message?: string; // Optional message (e.g. "No dates found in the next 30 days")
    error?: string;
    /** True when cached (no LLM call, same titles as previous) */
    from_cache?: boolean;
  };
  user_settings?: {
    seed_keywords: string[];
    active_season?: string;
  };
  data: Opportunity[];
  /** Present when source=competitors: raw gap analysis for RadarGapsSection */
  competitor_gap_analysis?: CompetitorTopicGapsResponse | null;
}

export interface FlashAuditResponse {
  topic: string;
  search_volume: number;
  keyword_difficulty: number;
  impact_score: number;
  recommendation: "high" | "medium" | "low";
  existing_article: string | null;
  competitor_positions: Array<{
    domain: string;
    position: number;
  }>;
  /** Titles suggested after SEO analysis (keyword direction) */
  suggested_titles?: string[];
}

export interface GenerateContentResponse {
  opportunity_id: string;
  status: "pending" | "in_progress" | "completed";
  workflow_steps: Array<{
    step: number;
    name: string;
    status: "pending" | "in_progress" | "completed";
    message: string | null;
  }>;
  estimated_completion: string;
}

// --- Gap / Concurrence APIs (Contexte section)
export interface BrandBlogsRecentResponse {
  count: number;
  blogs: Array<{ title: string }>;
}

export interface CompetitorsBlogsRecentResponse {
  count: number;
  blogs: Array<{
    source: string;
    url: string;
    title: string;
  }>;
}

export interface CompetitorOnlyTopic {
  topic: string;
  reason?: string;
  example_phrases?: string[];
}

export interface SharedHighValueKeyword {
  phrase: string;
  used_by: string[];
  seo_value: string;
}

export interface CompetitorTopicGapsResponse {
  competitor_only_topics: CompetitorOnlyTopic[];
  shared_high_value_keywords: SharedHighValueKeyword[];
}

// --- Trends by theme APIs (4 fixed themes)
export const CONTENT_THEME_IDS = [
  "AI in Marketing",
  "AI in Sales",
  "AI in Supply Chain",
  "AI Strategy & Governance",
] as const;
export type ContentThemeId = (typeof CONTENT_THEME_IDS)[number];

/** /harvest-eye-topics — trending topics (search request). Structure = backend API response. */
export interface HarvestEyeTopic {
  Ph: string;
  Nq: number;
  Kd: number;
  Intent: number;
  trend_score: number;
  topic_score: number;
}

/** Format partiel pour questions_people_ask / trending_phrases (API harvest-eye-topics). */
export interface HarvestEyeTopicShort {
  Ph: string;
  Nq: number;
  Kd: number;
  trend_score: number;
}

export interface HarvestEyeTopicsResponse {
  count: number;
  top_topics: HarvestEyeTopic[];
  /** Same structure as the backend API. */
  questions_people_ask?: HarvestEyeTopicShort[];
  trending_phrases?: HarvestEyeTopicShort[];
}

/** Topic in a theme (generate-eye-content-topics: competitors, trends, date) */
export interface TopicInTheme {
  topic: string;
  score: number;
  rank: number;
  content_intents: string[];
  /** API: "Strong" | "Good" | "Medium" | "Low" | "Weak" */
  confidence?: string;
}

export interface GenerateEyeContentTopicsResponse {
  source?: string;
  input_keyword_count?: number;
  competitor_gap_count?: number;
  generated_topics: {
    themes?: Record<string, TopicInTheme[]>;
    topics?: Array<{ id: number; title: string }>;
  };
}

/** POST /generate-eye-content-topics/from-keywords — 3 titles from keywords */
export interface GenerateEyeContentFromKeywordsRequest {
  keywords: string[];
  language: string;
}

export interface GenerateEyeContentFromKeywordsResponse {
  source: "keywords";
  competitor_gap_count?: number;
  generated_topics: {
    topics: Array<{ id: number; title: string }>;
  };
}

/** POST /generate-article-titles — 3 suggested titles from user input */
export interface GenerateArticleTitlesResponse {
  titles: string[];
}

/** POST /analyze-topic — KPI SEO pour un titre */
export interface AnalyzeTopicRequest {
  title: string;
}

export interface AnalyzeTopicResponse {
  title: string;
  seo_metrics: {
    topic_quality: number;
    coverage_potential: number;
    confidence: "Good" | "Medium" | "Low";
  };
}

// --- Article Builder (outline → draft → WordPress)
export type HeadingLevel = "H2" | "H3";

export interface GenerateArticleSectionsRequest {
  topic_title: string;
}

export interface GenerateArticleSection {
  order: number;
  type: string;
  title: string;
  description: string[];
  keywords: string[];
}

export interface ReviseArticleSectionRequest {
  order: number;
  title: string;
  description: string[];
  change_request?: string;
  language?: string;
  sibling_sections?: { title: string; summary: string }[];
}

export type ReviseArticleSectionResponse = GenerateArticleSection;

export interface OutlineWarning {
  type: "missing_section_type" | "wrong_section_count" | "wrong_order";
  message: string;
}

export interface GenerateArticleSectionsResponse {
  sections: GenerateArticleSection[];
  article_title: string;
  outline_warnings?: OutlineWarning[];
}

/** Request body for POST /generate-article (same shape as generate-article-sections output). */
export interface GenerateArticleRequest {
  sections: GenerateArticleSection[];
  article_title: string;
}

export interface GenerateArticleParagraph {
  id: number;
  text: string;
}

export interface GenerateArticleSectionContent {
  paragraphs: GenerateArticleParagraph[];
  bullets: unknown[];
}

export interface GenerateArticleSectionOutput {
  order: number;
  type: string;
  heading: string;
  content: GenerateArticleSectionContent;
}

export interface QualityFlag {
  section?: string;
  type: "thin_section" | "missing_keyword" | "attribution_overuse";
  message: string;
}

export interface GenerateArticleResponse {
  title: string;
  sections: GenerateArticleSectionOutput[];
  quality_flags?: QualityFlag[];
}

export interface EditArticleSectionRequest {
  paragraph_id: number;
  change_request: string;
  section: {
    order: number;
    type: string;
    heading: string;
    content: GenerateArticleSectionContent;
  };
}

export interface EditArticleSectionResponse {
  order: number;
  type: string;
  heading: string;
  content: GenerateArticleSectionContent;
}

export interface OutlineBullet {
  id: string;
  text: string;
  proof?: string;
}

export interface OutlineSection {
  id: string;
  headingLevel: HeadingLevel;
  /** Section type for API (introduction, section, comparison, how_to, safety, conclusion). */
  type?: string;
  title: string;
  /** Structured text of the section (edited directly, no bullets). */
  content?: string;
  bullets: OutlineBullet[];
  seo?: {
    keywords?: string[];
    faqQuestions?: string[];
  };
}

export interface ArticleDraftSection {
  sectionId: string;
  headingLevel: HeadingLevel;
  title: string;
  content: string;
}

/** Single block in the article (heading or paragraph). Used for document-style editing. */
export type ArticleDraftBlockType = "heading" | "paragraph";

export interface ArticleDraftBlock {
  id: string;
  type: ArticleDraftBlockType;
  /** For heading: plain text. For paragraph: can be HTML (bold, lists, etc.). */
  content: string;
  meta?: {
    sectionOrder?: number;
    sectionType?: string;
    paragraphId?: number;
  };
}

export interface ArticleDraft {
  id: string;
  title: string;
  /** Flattened list of blocks for document-style editing (Google Doc–like). */
  blocks: ArticleDraftBlock[];
  updatedAt: string;
}

export interface WordPressMetadata {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  /** Main SEO keyword (from /infer-article-metadata). */
  focus_keyword?: string;
  /** SEO title, ≤60 chars (from /infer-article-metadata). */
  seo_title?: string;
  /** Meta description, ≤160 chars (from /infer-article-metadata). */
  seo_description?: string;
}

/** POST /infer-article-metadata — request body. */
export interface InferArticleMetadataRequest {
  article: {
    title: string;
    sections: Array<{ type: string; content: string }>;
  };
  language?: string;
}

/** POST /infer-article-metadata — response (WordPress + SEO metadata). */
export interface SeoWarning {
  field: string;
  message: string;
}

export interface InferArticleMetadataResponse {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  focus_keyword: string;
  seo_title: string;
  seo_description: string;
  seo_warnings?: SeoWarning[];
}

export interface BuilderSession {
  step: 1 | 2 | 3;
  opportunityId: string;
  opportunity: Opportunity | null;
  outline: OutlineSection[];
  draft?: ArticleDraft | null;
  wpMetadata?: WordPressMetadata | null;
  lastSavedAt?: string | null;
  /** True when user has edited outline after draft was generated (for step 2 banner). */
  outlineEditedAfterDraft?: boolean;
}

// --- Builder Sessions API (Phase 4)
export interface BuilderSessionInfo {
  found?: true;
  opportunityId: string;
  sessionId: string;
  topicTitle: string;
  updatedAt: string;
  createdAt: string;
  creatorEmail?: string;
  outline?: OutlineSection[];
  draft?: ArticleDraft | null;
  wpMetadata?: WordPressMetadata | null;
  currentStep?: 1 | 2 | 3;
  /** ISO datetime when draft was sent to WordPress */
  sentToWordPressAt?: string | null;
  /** Opportunity metadata stored at session creation to inform generation */
  opportunityContext?: {
    theme?: string;
    intents?: string[];
    content_brief?: string;
    justification_signals?: string[];
    tags?: string[];
    creatorEmail?: string;
  };
}

/** GET /api/builder-sessions/:id returns this when no session exists (200, no 404) */
export interface BuilderSessionNotFound {
  found: false;
  opportunityId: string;
}

export type BuilderSessionResponse = BuilderSessionInfo | BuilderSessionNotFound;

export interface BuilderSessionCreateRequest {
  opportunity_id?: string;
  topic_title: string;
  opportunity_context?: {
    theme?: string;
    intents?: string[];
    content_brief?: string;
    justification_signals?: string[];
    tags?: string[];
  };
}

export interface BuilderSessionUpdateRequest {
  outline?: OutlineSection[];
  article?: ArticleDraft | null;
  metadataWordPress?: WordPressMetadata | null;
  currentStep?: 1 | 2 | 3;
  sentToWordPressAt?: string | null;
}

// --- GEO (Generative Engine Optimization) Analytics
export type GeoLLMId = "gpt" | "perplexity" | "claude";

export interface GeoLLMOption {
  id: GeoLLMId;
  label: string;
  /** Environment variable name that must be set to enable this LLM */
  requiresKey: string;
}

export interface GeoPromptResult {
  prompt: string;
  /** Citation rate 0–100 (GPT: 0 or 100 per prompt) */
  citationRateByLLM: Partial<Record<GeoLLMId, number>>;
  avgCitationRate: number;
  rank: number;
  lastRun?: string;
  /** Bench metrics */
  cited?: boolean;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** When runsPerPrompt or variantsPerPrompt > 1: number of runs and how many cited */
  runs?: number;
  citedCount?: number;
  mode?: GeoRunMode;
  /** In variants mode: each similar prompt run with snippet, full response, citation level, and position rank. */
  variantRuns?: GeoVariantRun[];
  /** Estimated cost in USD for this prompt (all runs/variants). */
  estimatedCostUsd?: number;
  /** Position in the answer: top 1/5/10/25/33/50/66/75% of answer. */
  answerPosition?: "top_1" | "top_5" | "top_10" | "top_25" | "top_33" | "top_50" | "top_66" | "top_75" | null;
  /** Total distinct sources/brands mentioned in the answer(s). */
  sourceCount?: number;
  /** Your share of voice: 1/sourceCount (0–1). */
  shareOfVoice?: number;
  /** All source domains/brands extracted from the answer(s). */
  sourcesFound?: string[];
  /** Competitor citation results for this prompt. */
  competitorResults?: GeoCompetitorResult[];
  /** Recommendation confidence: 1 (weak mention) to 5 (strong recommendation). */
  confidenceScore?: number;
}

/** Citation strength: direct page URL, site URL, brand name only, or not cited. */
export type GeoCitationLevel = "direct_page" | "site" | "brand" | "none";

export interface GeoVariantRun {
  prompt: string;
  snippet: string;
  fullResponse: string;
  /** Legacy: true when citationLevel !== "none". */
  cited: boolean;
  /** Rigorous citation level (direct page > site > brand > none). */
  citationLevel: GeoCitationLevel;
  /** When using LLM judge: e.g. "Main company", "Brand: AI To Market", "Sub-entity: AITOM", "Not cited". */
  citationTag?: string;
  /** 1-based position among all cited sources in the answer (null if not cited). */
  positionRank: number | null;
  /** Position in answer text: top 1/5/10/25/33/50/66/75% of answer. */
  answerPosition?: "top_1" | "top_5" | "top_10" | "top_25" | "top_33" | "top_50" | "top_66" | "top_75" | null;
  /** Sources/brands found in the answer. */
  sourcesFound?: string[];
  /** Competitor citation check for this variant. */
  competitorResults?: GeoCompetitorResult[];
  /** Recommendation confidence 1–5. */
  confidenceScore?: number;
}

export interface GeoCompetitorResult {
  name: string;
  url?: string;
  cited: boolean;
  citationLevel: GeoCitationLevel;
}

export type GeoRunMode = "repeat" | "variants";

export type GeoCitationBranch = "homepage" | "blog" | "other";

export interface GeoCompetitorInput {
  name: string;
  url?: string;
}

/** Main company, brand, or sub-entity used by the LLM citation judge. */
export interface GeoBrandEntity {
  name: string;
  type: "main" | "brand" | "sub_entity";
}

export interface GeoRunRequest {
  prompts: string[];
  mainUrl?: string;
  companyName?: string;
  /** Optional: main company + brands/sub-entities for smart citation detection (LLM judge). */
  brandEntities?: GeoBrandEntity[];
  vertical?: string;
  mode: GeoRunMode;
  citationBranch?: GeoCitationBranch;
  runsPerPrompt?: number;
  variantsPerPrompt?: number;
  /** Competitor names/URLs to check alongside your own. */
  competitors?: GeoCompetitorInput[];
  /** If true, use search model (web search). If false, use knowledge-only model (cheaper). */
  useWebSearch?: boolean;
  /** Which LLMs to benchmark. Defaults to ["gpt"]. Requires API keys for non-GPT engines. */
  targetLLMs?: GeoLLMId[];
}

export interface GeoRunResponse {
  results: GeoPromptResult[];
  runId?: string;
  totalLatencyMs?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalEstimatedCostUsd?: number;
  model?: string;
  /** LLMs that were skipped due to missing API keys */
  skippedLLMs?: GeoLLMId[];
}

// ─── Identity Analysis (GEO) ─────────────────────────────────────────────

export type IdentitySentiment = "positive" | "neutral" | "negative";
export type IdentityMentionPosition = "first" | "middle" | "last" | "only";

export interface IdentityQueryResult {
  query: string;
  queryType: string;
  snippet: string;
  /** Full model response for modal view. */
  fullResponse?: string;
  mentioned: boolean;
  positionInResponse?: IdentityMentionPosition;
}

export interface IdentityAnalysisResult {
  /** Combined summary of what the model(s) said about the brand. */
  summary: string;
  /** Query index (1-based) where brand was first mentioned, or null if never found. */
  timeToFindQueryIndex: number | null;
  /** % of queries (across query types) where the brand was mentioned. */
  mentionRatePercent: number;
  /** % of provided key messages that appeared in model responses (0–100). */
  attributeCoveragePercent: number;
  /** Sentiment when the brand is mentioned (positive/neutral/negative). */
  sentiment: IdentitySentiment;
  /** Where the brand tended to appear in responses: first, middle, or last. */
  prominence: IdentityMentionPosition;
  /** Per-query results: query, snippet, mentioned, position. */
  queryResults: IdentityQueryResult[];
  /** How many query types (e.g. brand, category, problem) had at least one mention. */
  queryTypeCoverageCount: number;
  /** Total query types run (e.g. 5). */
  queryTypeCoverageTotal: number;
}

// --- Article GEO Score

export interface GeoCheck {
  label: string;
  pass: boolean;
  evidence?: string;
}

export interface GeoScore {
  score: number;      // 0–100 in steps of 20 (five checks × 20 pts each)
  checks: GeoCheck[];
  wordCount: number;  // reported separately, not counted in score
}

// --- Brand Voice Status

export interface BrandVoiceResidual {
  paragraphIndex: number;
  violations: Array<{ type: string; match: string }>;
}

export interface BrandVoiceStatus {
  status: "clean" | "partial" | "error";
  residuals?: BrandVoiceResidual[]; // populated only when status === "partial"
}

// --- Structured Data / JSON-LD Generator

export type SchemaType =
  | "Organization"
  | "WebSite"
  | "Article"
  | "FAQPage"
  | "Product"
  | "BreadcrumbList"
  | "SpeakableSpecification";

export interface FaqPair {
  question: string;
  answer: string;
}

export interface ProductInfo {
  name: string;
  description: string;
  url?: string;
}

export interface StructuredDataInput {
  companyName: string;
  siteUrl: string;
  description: string;
  /** Industry vertical e.g. "Retail Technology", "SaaS" */
  vertical?: string;
  /** Founding year e.g. 2015 */
  foundingYear?: number;
  /** Wikipedia or Wikidata URL for sameAs — critical for LLM entity resolution */
  wikipediaUrl?: string;
  /** Additional sameAs URLs (LinkedIn, Crunchbase, etc.) */
  sameAsUrls?: string[];
  /** Logo URL */
  logoUrl?: string;
  /** Main contact email */
  contactEmail?: string;
  /** Key products/services */
  products?: ProductInfo[];
  /** FAQ pairs for FAQPage schema */
  faqs?: FaqPair[];
  /** Which schema types to generate */
  schemaTypes: SchemaType[];
}

export interface GeneratedSchema {
  type: SchemaType;
  /** Ready-to-paste JSON-LD object */
  jsonLd: Record<string, unknown>;
  /** Completeness 0–100 */
  completeness: number;
  /** What fields are missing that would improve this schema */
  missingFields: string[];
  /** Why this schema matters for GEO */
  geoImpact: string;
}

export interface StructuredDataGeneratorResponse {
  schemas: GeneratedSchema[];
  /** Overall GEO coverage score 0–100 across all generated schemas */
  geoCoverageScore: number;
  /** Prioritized next actions */
  recommendations: string[];
}


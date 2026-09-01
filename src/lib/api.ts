/**
 * Client API for the Content Radar.
 * Base URL: NEXT_PUBLIC_API_URL or fallback for dev (mock if empty).
 * All calls are logged in the API log (api-log.ts).
 */

import { addLog } from "./api-log";

const resolveBaseUrl = (): string => {
  const fromVite =
    typeof import.meta !== "undefined"
      ? ((import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_API_URL ??
        "")
      : "";
  const fromNext = process.env.NEXT_PUBLIC_API_URL ?? "";
  const raw = (fromVite || fromNext || "").trim();
  // No API URL or mocks forced → use same origin so Next.js API routes are used
  if (!raw || (typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true")) {
    return "";
  }
  return raw.replace(/\/$/, "");
};

export const API_BASE_URL = resolveBaseUrl();
export const apiBaseUrl = API_BASE_URL;

/** If true, mocks are always used (same structure as the APIs). Useful when the API is unavailable. */
export const isMockEnvForced = (): boolean =>
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export const hasApi = (): boolean => Boolean(API_BASE_URL);

function sectionFromPath(path: string): "opportunities" | "tendances" | "gap" | "from-keywords" | "article-sections" | "api" {
  const p = path.replace(/^\//, "").toLowerCase();
  if (
    p.includes("builder-sessions") ||
    p.includes("revise-selection")
  )
    return "article-sections";
  if (p.includes("generate-eye-content-topics/from-keywords")) return "from-keywords";
  if (p.includes("generate-article-titles")) return "from-keywords";
  if (p.includes("generate-eye-content-topics/competitors") || p.includes("analyze-topic")) return "opportunities";
  if (p.includes("harvest-eye-topics") || p === "generate-eye-content-topics") return "tendances";
  if (p.includes("aitm/blogs") || p.includes("competitors/blogs") || p.includes("competitor-topic-gaps")) return "gap";
  return "api";
}

async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const section = sectionFromPath(path);
  const label = path.replace(/^\//, "") || path;
  const start = Date.now();
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const { body, ...rest } = options;

  try {
    const res = await fetch(url, {
      ...rest,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
      ...(body !== undefined && body !== null
        ? { body: JSON.stringify(body) }
        : {}),
    });
    const durationMs = Date.now() - start;
    if (!res.ok) {
      const text = await res.text();
      addLog({
        section,
        label,
        method,
        path,
        status: res.status,
        durationMs,
        error: `${res.status}: ${text || res.statusText}`,
      });
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }
    addLog({
      section,
      label,
      method,
      path,
      status: res.status,
      durationMs,
    });
    
    // Handle 204 No Content (no body)
    if (res.status === 204) {
      return undefined as T;
    }
    
    // Check if response has content
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return res.json() as Promise<T>;
    }
    
    // Return empty object for other successful responses
    return {} as T;
  } catch (err) {
    const durationMs = Date.now() - start;
    addLog({
      section,
      label,
      method,
      path,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** POST /generate-article-titles — 3 suggested titles from input (keywords, title, ideas, etc.) */
export async function generateArticleTitles(
  userInput: string,
  language: string = "en"
) {
  return apiFetch<import("@/types").GenerateArticleTitlesResponse>(
    "/generate-article-titles",
    {
      method: "POST",
      body: { user_input: userInput, language },
    }
  );
}

/** POST /generate-eye-content-topics/from-keywords */
export async function generateTopicsFromKeywords(
  keywords: string[],
  language: string = "en"
) {
  return apiFetch<import("@/types").GenerateEyeContentFromKeywordsResponse>(
    "/generate-eye-content-topics/from-keywords",
    {
      method: "POST",
      body: { keywords, language },
    }
  );
}

/** POST /generate-eye-content-topics/competitors */
export async function generateTopicsCompetitors() {
  return apiFetch<import("@/types").GenerateEyeContentTopicsResponse>(
    "/generate-eye-content-topics/competitors",
    { method: "POST", body: {} }
  );
}

/** POST /analyze-topic */
export async function analyzeTopic(title: string) {
  return apiFetch<import("@/types").AnalyzeTopicResponse>("/analyze-topic", {
    method: "POST",
    body: { title },
  });
}

/** GET /competitors/blogs/recent */
export async function getCompetitorsBlogsRecent() {
  return apiFetch<import("@/types").CompetitorsBlogsRecentResponse>(
    "/competitors/blogs/recent"
  );
}

/** GET /aitm/blogs/recent */
export async function getBrandBlogsRecent() {
  return apiFetch<import("@/types").BrandBlogsRecentResponse>(
    "/aitm/blogs/recent"
  );
}

/** GET /content/competitor-topic-gaps */
export async function getCompetitorTopicGaps() {
  return apiFetch<import("@/types").CompetitorTopicGapsResponse>(
    "/content/competitor-topic-gaps"
  );
}

/** GET /content/competitor-topic-gaps/latest — latest cache in DB, no WordPress/competitors fetch */
export async function getCompetitorTopicGapsLatest() {
  return apiFetch<import("@/types").CompetitorTopicGapsResponse | { error: string }>(
    "/content/competitor-topic-gaps/latest"
  );
}

/** GET /harvest-eye-topics */
export async function getHarvestEyeTopics() {
  return apiFetch<import("@/types").HarvestEyeTopicsResponse>(
    "/harvest-eye-topics"
  );
}

/** GET /generate-eye-content-topics (trends by theme) */
export async function getGenerateEyeContentTopics() {
  return apiFetch<import("@/types").GenerateEyeContentTopicsResponse>(
    "/generate-eye-content-topics"
  );
}

// ======================================================
// Phase 1: Keywords & Dates API
// ======================================================

/** GET /api/keywords — fetches seed keywords */
export async function getKeywords() {
  return apiFetch<{ seed_keywords: string[] }>("/api/keywords");
}

/** PATCH /api/keywords — updates seed keywords */
export async function patchKeywords(seed_keywords: string[]) {
  return apiFetch<{ seed_keywords: string[] }>("/api/keywords", {
    method: "PATCH",
    body: { seed_keywords },
  });
}

/** GET /api/dates — fetches key dates */
export async function getDates() {
  return apiFetch<{ big_dates: import("@/types").BigDate[] }>("/api/dates");
}

/** PATCH /api/dates — updates key dates */
export async function patchDates(big_dates: import("@/types").BigDate[]) {
  return apiFetch<{ big_dates: import("@/types").BigDate[] }>("/api/dates", {
    method: "PATCH",
    body: { big_dates },
  });
}


// ======================================================
// Phase 3: Opportunities Cache API
// ======================================================

/** GET /api/opportunities — fetches opportunities from DB cache */
export async function getOpportunities() {
  return apiFetch<import("@/types").OpportunitiesResponse>("/api/opportunities");
}

/** POST /api/opportunities/refresh/competitors — refreshes cache for competitors (gap). force=true: bypass cache, always call LLM */
export async function postOpportunitiesRefreshCompetitors(force = false) {
  const url = force
    ? "/api/opportunities/refresh/competitors?force=true"
    : "/api/opportunities/refresh/competitors";
  return apiFetch<import("@/types").OpportunitiesResponse>(url, {
    method: "POST",
  });
}

/** POST /api/opportunities/refresh/dates — refreshes cache for dates (seasonal). force=true: bypass cache, regenerate for all dates */
export async function postOpportunitiesRefreshDates(force = false) {
  const url = force
    ? "/api/opportunities/refresh/dates?force=true"
    : "/api/opportunities/refresh/dates";
  return apiFetch<import("@/types").OpportunitiesResponse>(url, {
    method: "POST",
  });
}

/** POST /api/opportunities/refresh/trends — refreshes cache for trends (SEMrush) */
export async function postOpportunitiesRefreshTrends() {
  return apiFetch<import("@/types").OpportunitiesResponse>("/api/opportunities/refresh/trends", {
    method: "POST",
  });
}

/** POST /api/opportunities/refresh/all — runs all 3 refreshes (competitors, dates, trends) */
export async function postOpportunitiesRefreshAll() {
  return apiFetch<{ ok: boolean; results: unknown[]; meta: { last_updated: string } }>(
    "/api/opportunities/refresh/all",
    { method: "POST" }
  );
}

// ======================================================
// Phase 4: Builder Sessions API
// ======================================================

/** GET /api/builder-sessions — fetches all sessions (sorted by updated_at desc) */
export async function getBuilderSessions() {
  return apiFetch<import("@/types").BuilderSessionInfo[]>("/api/builder-sessions");
}

/** GET /api/builder-sessions/:opportunityId — fetches session by opportunityId (200 + { found: false } if missing) */
export async function getBuilderSession(opportunityId: string) {
  return apiFetch<import("@/types").BuilderSessionResponse>(`/api/builder-sessions/${opportunityId}`);
}

/** POST /api/builder-sessions — creates a new session */
export async function postBuilderSession(body: import("@/types").BuilderSessionCreateRequest) {
  return apiFetch<import("@/types").BuilderSessionInfo>("/api/builder-sessions", {
    method: "POST",
    body,
  });
}

/** PATCH /api/builder-sessions/:opportunityId — updates a session (autosave) */
export async function patchBuilderSession(
  opportunityId: string,
  body: import("@/types").BuilderSessionUpdateRequest
) {
  return apiFetch<import("@/types").BuilderSessionInfo>(`/api/builder-sessions/${opportunityId}`, {
    method: "PATCH",
    body,
  });
}

// ======================================================
// Phase 5: Builder Sessions content generation (via backend, no direct LLM)
// ======================================================

/** POST /api/builder-sessions/:id/generate-outline — generates outline via LLM and updates session */
export async function postGenerateOutline(
  opportunityId: string,
  body: { topic_title?: string; theme?: string; intents?: string[]; content_brief?: string; justification_signals?: string[]; tags?: string[] } = {}
) {
  return apiFetch<import("@/types").GenerateArticleSectionsResponse>(
    `/api/builder-sessions/${opportunityId}/generate-outline`,
    { method: "POST", body }
  );
}

/** POST /api/builder-sessions/:id/validate-plan — generates article via LLM and updates session */
export async function postValidatePlan(
  opportunityId: string,
  body: { outline?: import("@/types").OutlineSection[] } = {}
) {
  return apiFetch<import("@/types").GenerateArticleResponse>(
    `/api/builder-sessions/${opportunityId}/validate-plan`,
    { method: "POST", body }
  );
}

/** POST /api/builder-sessions/:id/validate-plan — streaming SSE version.
 *  Calls onChunk for each token, onDone with the final article, quality flags, and GEO score. */
export async function streamValidatePlan(
  opportunityId: string,
  body: { outline?: import("@/types").OutlineSection[] },
  onChunk: (text: string) => void,
  onDone: (
    article: import("@/types").GenerateArticleResponse,
    qualityFlags: import("@/types").QualityFlag[],
    geoScore: import("@/types").GeoScore | null,
    brandVoiceStatus: import("@/types").BrandVoiceStatus | undefined,
  ) => void
): Promise<void> {
  const res = await fetch(`/api/builder-sessions/${opportunityId}/validate-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      try {
        const evt = JSON.parse(part.slice(6)) as {
          chunk?: string;
          done?: boolean;
          article?: import("@/types").GenerateArticleResponse;
          quality_flags?: import("@/types").QualityFlag[];
          geo_score?: import("@/types").GeoScore | null;
          brand_voice_status?: import("@/types").BrandVoiceStatus | null;
          error?: string;
        };
        if (evt.error) throw new Error(evt.error);
        if (evt.chunk) onChunk(evt.chunk);
        if (evt.done && evt.article) {
          onDone(evt.article, evt.quality_flags ?? [], evt.geo_score ?? null, evt.brand_voice_status ?? undefined);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
      }
    }
  }
}

/** POST /api/builder-sessions/:id/generate-metadata — infers WordPress metadata via LLM and updates session */
export async function postGenerateMetadata(opportunityId: string) {
  return apiFetch<import("@/types").InferArticleMetadataResponse>(
    `/api/builder-sessions/${opportunityId}/generate-metadata`,
    { method: "POST" }
  );
}

/** POST /api/builder-sessions/:id/send-to-wordpress — envoie le brouillon sur WordPress et marque la session */
export async function postSendToWordPress(opportunityId: string) {
  return apiFetch<{
    id: number;
    link: string;
    title: string;
    status: string;
    metadata?: import("@/types").WordPressMetadata;
    brandVoiceStatus?: import("@/types").BrandVoiceStatus;
    geoScore?: import("@/types").GeoScore | null;
    correctedDraft?: import("@/types").ArticleDraft;
  }>(`/api/builder-sessions/${opportunityId}/send-to-wordpress`, {
    method: "POST",
  });
}

/** POST /api/builder-sessions/:id/fix-geo — LLM patches the draft to fix one failing GEO check */
export async function postFixGeo(opportunityId: string, checkLabel: string) {
  return apiFetch<{
    draft: import("@/types").ArticleDraft;
    geoScore: import("@/types").GeoScore;
  }>(`/api/builder-sessions/${opportunityId}/fix-geo`, {
    method: "POST",
    body: { checkLabel },
  });
}

/** POST /api/builder-sessions/:id/publish-live — publishes the Sanity draft to the live AITOM website */
export async function postPublishLive(opportunityId: string) {
  return apiFetch<{ id: string; link: string; status: string }>(
    `/api/builder-sessions/${opportunityId}/publish-live`,
    { method: "POST" }
  );
}

/** POST /api/builder-sessions/:id/revise-section — regenerates a section of the outline and updates session */
export async function postReviseSection(
  opportunityId: string,
  body: import("@/types").ReviseArticleSectionRequest
) {
  return apiFetch<import("@/types").ReviseArticleSectionResponse>(
    `/api/builder-sessions/${opportunityId}/revise-section`,
    { method: "POST", body }
  );
}

/** POST /api/builder-sessions/:id/edit-paragraph — edits a paragraph and updates session */
export async function postEditParagraph(
  opportunityId: string,
  body: import("@/types").EditArticleSectionRequest
) {
  return apiFetch<import("@/types").EditArticleSectionResponse>(
    `/api/builder-sessions/${opportunityId}/edit-paragraph`,
    { method: "POST", body }
  );
}

/** POST /api/builder-sessions/:id/refine-draft — second AI pass to elevate draft to industry level */
export async function postRefineDraft(opportunityId: string, draft: import("@/types").ArticleDraft) {
  return apiFetch<{
    draft: import("@/types").ArticleDraft;
    geoScore: import("@/types").GeoScore | null;
    brandVoiceStatus: import("@/types").BrandVoiceStatus | undefined;
  }>(
    `/api/builder-sessions/${opportunityId}/refine-draft`,
    { method: "POST", body: { draft } }
  );
}

/** POST /api/builder-sessions/:id/rescore — re-run brand voice + GEO checks on the saved draft, no rewriting */
export async function postRescore(opportunityId: string, draft?: import("@/types").ArticleDraft) {
  return apiFetch<{
    brandVoiceStatus: import("@/types").BrandVoiceStatus | undefined;
    geoScore: import("@/types").GeoScore | null;
  }>(
    `/api/builder-sessions/${opportunityId}/rescore`,
    { method: "POST", body: draft ? { draft } : undefined }
  );
}

/** POST /api/builder-sessions/:id/revise-selection — AI modifies selected text */
export async function postReviseSelection(
  opportunityId: string,
  body: {
    selected_text: string;
    change_request?: string;
    language?: string;
    article_context?: string;
  }
) {
  return apiFetch<{ text: string }>(
    `/api/builder-sessions/${opportunityId}/revise-selection`,
    { method: "POST", body }
  );
}

/** POST /api/builder-sessions/:id/check-brand-voice — detect violations (mode: "check") */
export async function postCheckBrandVoice(opportunityId: string) {
  type R = { checks: import("@/lib/brand-voice-checker").CheckResult[]; totalViolations: number };
  return apiFetch<R>(`/api/builder-sessions/${opportunityId}/check-brand-voice`, {
    method: "POST",
    body: { mode: "check" },
  });
}

/** POST /api/builder-sessions/:id/check-brand-voice — detect + correct violations (mode: "correct") */
export async function postCorrectBrandVoice(opportunityId: string) {
  type R = {
    checks: import("@/lib/brand-voice-checker").CheckResult[];
    corrections: import("@/lib/brand-voice-checker").CorrectionResult[];
    totalViolations: number;
  };
  return apiFetch<R>(`/api/builder-sessions/${opportunityId}/check-brand-voice`, {
    method: "POST",
    body: { mode: "correct" },
  });
}

/** POST /revise-selection — standalone (no session) */
export async function reviseSelection(
  body: {
    selected_text: string;
    change_request?: string;
    language?: string;
    article_context?: string;
  }
) {
  return apiFetch<{ text: string }>(
    "/revise-selection",
    { method: "POST", body }
  );
}

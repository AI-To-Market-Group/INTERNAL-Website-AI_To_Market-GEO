import { parseBody, ok, err } from "@/lib/api-response";
import { geoRunSchema } from "@/lib/api-schemas";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { dbSaveGeoRun } from "@/lib/db/geo-runs";
import { requireUser } from "@/lib/api-auth";
import { checkBudget } from "@/lib/budget-guard";
import type {
  GeoBrandEntity,
  GeoCitationLevel,
  GeoCompetitorInput,
  GeoCompetitorResult,
  GeoPromptResult,
  GeoRunRequest,
  GeoRunResponse,
  GeoVariantRun,
} from "@/types";

const GEO_MODEL = "gpt-4o-mini-search-preview";
/** Citation judge + knowledge mode: no web search needed — use gpt-5.4-nano. */
const JUDGE_MODEL = "gpt-5.4-nano";
const SNIPPET_LEN = 300;

// Allow longer-running GEO benchmarks on platforms that support per-route limits (e.g. Vercel).
// Value is in seconds.
export const maxDuration = 300;

// gpt-4o-mini-search-preview pricing (USD per 1M tokens)
const PRICE_INPUT_PER_M = 0.15;
const PRICE_OUTPUT_PER_M = 0.60;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_INPUT_PER_M + outputTokens * PRICE_OUTPUT_PER_M) / 1_000_000;
}

function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Normalize a brand/company name for text search:
// - trim
// - lowercase
// - strip leading/trailing non-alphanumeric (e.g. trailing "." or ",")
function normalizeNameForSearch(value: string | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function getCitationLevel(
  response: string,
  mainUrl: string | undefined,
  companyName: string | undefined
): { level: GeoCitationLevel; firstIndex: number } {
  const text = response.toLowerCase().trim();
  if (!text) return { level: "none", firstIndex: -1 };

  const domain = mainUrl ? normalizeDomain(mainUrl) : "";
  const urlLower = mainUrl?.toLowerCase() ?? "";
  const nameLower = normalizeNameForSearch(companyName);

  let level: GeoCitationLevel = "none";
  let firstIndex = -1;

  if (urlLower && text.includes(urlLower)) {
    const i = text.indexOf(urlLower);
    if (firstIndex === -1 || i < firstIndex) firstIndex = i;
    level = "direct_page";
  }
  if (domain && text.includes(domain)) {
    const i = text.indexOf(domain);
    if (firstIndex === -1 || i < firstIndex) firstIndex = i;
    if (level === "none") level = "site";
  }
  if (nameLower && text.includes(nameLower)) {
    const i = text.indexOf(nameLower);
    if (firstIndex === -1 || i < firstIndex) firstIndex = i;
    if (level === "none") level = "brand";
  }

  return { level, firstIndex };
}

/** LLM judge: does the answer cite the org (main company or any brand/sub-entity)? Returns cited, level, and a tag. */
interface CitationJudgeResult {
  cited: boolean;
  citationLevel: GeoCitationLevel;
  citationTag: string;
}

async function callCitationJudge(
  content: string,
  companyName: string | undefined,
  brandEntities: GeoBrandEntity[],
  mainUrl: string | undefined,
  apiKey: string
): Promise<CitationJudgeResult> {
  const entityList =
    brandEntities.length > 0
      ? brandEntities
          .map((e) => `- ${e.name} (${e.type})`)
          .join("\n")
      : companyName
        ? `- ${companyName} (main)`
        : "";
  const system = `You are a citation judge for search engine answers. Given an ANSWER text and an ORGANIZATION (main company plus optional brands/sub-entities), determine:
1) Is the organization or ANY of its brands/sub-entities cited or mentioned? Consider spelling variations (e.g. AI To Market vs aitomarket vs AITOM), partial names, and known sub-brands.
2) If cited, what is the strength: direct_page (specific URL mentioned), site (domain only), brand (company/brand name only), or none.
3) If cited, which entity was found: the main company or a specific brand/sub-entity. Set citationTag to a short label.

Return ONLY valid JSON with this exact shape (no markdown):
{"cited": true or false, "citationLevel": "direct_page"|"site"|"brand"|"none", "citationTag": "string"}

citationTag examples when cited: "Main company", "Brand: AITOM", "Sub-entity: AI To Market Group". When not cited use "Not cited".`;

  const user = `ORGANIZATION (main + brands/sub-entities):\n${entityList}\n\nMain URL (if any): ${mainUrl ?? "none"}\n\nANSWER to analyze:\n${content.slice(0, 3500)}`;

  const res = await fetchWithRetry(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Citation judge ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { cited?: boolean; citationLevel?: string; citationTag?: string };
  const level = (parsed.citationLevel === "direct_page" || parsed.citationLevel === "site" || parsed.citationLevel === "brand" || parsed.citationLevel === "none")
    ? parsed.citationLevel
    : "none";
  return {
    cited: Boolean(parsed.cited),
    citationLevel: level,
    citationTag: typeof parsed.citationTag === "string" ? parsed.citationTag : (parsed.cited ? "Cited" : "Not cited"),
  };
}

function firstCitationIndex(
  text: string,
  companyName: string | undefined,
  brandEntities: GeoBrandEntity[]
): number {
  const lower = text.toLowerCase();
  let first = -1;
  const check = (name: string) => {
    const n = normalizeNameForSearch(name);
    if (!n) return;
    const i = lower.indexOf(n);
    if (i >= 0 && (first === -1 || i < first)) first = i;
  };
  if (companyName) check(companyName);
  for (const e of brandEntities) check(e.name);
  return first;
}

type AnswerPosition = "top_1" | "top_5" | "top_10" | "top_25" | "top_33" | "top_50" | "top_66" | "top_75" | null;

function getAnswerPosition(text: string, firstIndex: number): AnswerPosition {
  if (firstIndex < 0) return null;
  const len = text.length;
  if (len === 0) return null;
  const ratio = firstIndex / len;
  if (ratio < 0.01) return "top_1";
  if (ratio < 0.05) return "top_5";
  if (ratio < 0.1) return "top_10";
  if (ratio < 0.25) return "top_25";
  if (ratio < 0.33) return "top_33";
  if (ratio < 0.5) return "top_50";
  if (ratio < 0.66) return "top_66";
  if (ratio < 0.75) return "top_75";
  return "top_75";
}

const VALID_TLDS = new Set([
  "com","net","org","io","co","uk","fr","de","it","es","au","ca",
  "gov","edu","mil","info","biz","tech","app","dev","ai","us","eu",
  "ch","nl","be","se","no","dk","jp","cn","kr","br","mx","ar","in",
  "ru","pl","at","pt","nz","za","sg","hk","tw","online","shop",
  "media","news","global","health","store","cloud","design",
  "solutions","website","digital","consulting","agency","group",
  "network","systems","vision","care","glasses","lenses","eyewear",
]);

/** Extract domain-like tokens from model output as rough source list. */
function extractSources(text: string): string[] {
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?([a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)*\.[a-z]{2,})/gi;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = urlPattern.exec(text)) !== null) {
    const domain = m[1].toLowerCase();
    const parts = domain.split(".");
    const tld = parts[parts.length - 1];
    if (VALID_TLDS.has(tld) && parts.length >= 2 && parts[0].length >= 2) {
      found.add(domain);
    }
  }
  return [...found];
}

function checkCompetitors(
  response: string,
  competitors: GeoCompetitorInput[]
): GeoCompetitorResult[] {
  return competitors.map((c) => {
    const { level } = getCitationLevel(response, c.url, c.name);
    return {
      name: c.name,
      url: c.url,
      cited: level !== "none",
      citationLevel: level,
    };
  });
}

interface LLMCallResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

async function callGeoGPT(
  userPrompt: string,
  systemPrompt: string,
  apiKey: string,
  model: string = GEO_MODEL,
  temperature?: number
): Promise<LLMCallResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);
  let res: Response;
  try {
    res = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          ...(temperature !== undefined ? { temperature } : {}),
        }),
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { finish_reason?: string; message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = data.choices?.[0];
  const finishReason = choice?.finish_reason ?? "no_choices";
  const content = choice?.message?.content?.trim() ?? "";
  if (!content) {
    throw new Error(`Empty response from model (finish_reason: ${finishReason})`);
  }
  const usage = data.usage;
  return {
    content,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    latencyMs,
  };
}

const GEO_SYSTEM = `You are an AI search engine. Answer the user's question directly and helpfully.

- Recommend 3 to 5 options maximum. List each one exactly once. Never repeat a brand or product.
- For each recommendation include the brand name, one sentence of context, and its domain (e.g. mckinsey.com, gartner.com).
- Stop after your last recommendation. No closing summary, no "hope this helps", no follow-up paragraphs.
- Do not start with "As of my knowledge update" or "I cannot provide information after [date]" — just answer.
- No disclaimer paragraphs.`;

// Perplexity pricing: sonar model (USD per 1M tokens) — approximate
const PERPLEXITY_PRICE_INPUT_PER_M = 1.0;
const PERPLEXITY_PRICE_OUTPUT_PER_M = 1.0;

// Claude Haiku pricing (USD per 1M tokens)
const CLAUDE_PRICE_INPUT_PER_M = 0.80;
const CLAUDE_PRICE_OUTPUT_PER_M = 4.0;

async function callGeoPerplexity(
  userPrompt: string,
  apiKey: string
): Promise<LLMCallResult> {
  const start = Date.now();
  const res = await fetchWithRetry(
    "https://api.perplexity.ai/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: GEO_SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    }
  );
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Perplexity ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    citations?: string[];
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  const citationsFromApi: string[] = data.citations ?? [];
  // Inject Perplexity citations array into content as a suffix for our extraction logic
  const citationSuffix =
    citationsFromApi.length > 0
      ? "\n\nSources: " + citationsFromApi.join(" ")
      : "";
  return {
    content: content + citationSuffix,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    latencyMs,
  };
}

async function callGeoClaude(
  userPrompt: string,
  apiKey: string
): Promise<LLMCallResult> {
  const start = Date.now();
  const res = await fetchWithRetry(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_completion_tokens: 1024,
        system: GEO_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    }
  );
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const content =
    data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  return {
    content,
    promptTokens: data.usage?.input_tokens ?? 0,
    completionTokens: data.usage?.output_tokens ?? 0,
    latencyMs,
  };
}

function estimateCostForLLM(llmId: string, inputTokens: number, outputTokens: number): number {
  if (llmId === "perplexity") {
    return (inputTokens * PERPLEXITY_PRICE_INPUT_PER_M + outputTokens * PERPLEXITY_PRICE_OUTPUT_PER_M) / 1_000_000;
  }
  if (llmId === "claude") {
    return (inputTokens * CLAUDE_PRICE_INPUT_PER_M + outputTokens * CLAUDE_PRICE_OUTPUT_PER_M) / 1_000_000;
  }
  return estimateCost(inputTokens, outputTokens);
}

/** Analyze a single answer: citation, position, sources, competitors, confidence. Optional LLM judge result for smart citation + tag. */
function analyzeAnswer(
  content: string,
  mainUrl: string | undefined,
  companyName: string | undefined,
  competitors: GeoCompetitorInput[],
  options?: { judgeResult: CitationJudgeResult; brandEntities: GeoBrandEntity[] }
) {
  let level: GeoCitationLevel;
  let firstIndex: number;
  let citationTag: string | undefined;

  if (options?.judgeResult) {
    level = options.judgeResult.citationLevel;
    citationTag = options.judgeResult.citationTag;
    firstIndex = options.judgeResult.cited
      ? firstCitationIndex(content, companyName, options.brandEntities)
      : -1;
  } else {
    const got = getCitationLevel(content, mainUrl, companyName);
    level = got.level;
    firstIndex = got.firstIndex;
  }

  const cited = level !== "none";
  const answerPosition = getAnswerPosition(content, firstIndex);
  const sourcesFound = extractSources(content);

  const sourceCount = sourcesFound.length;
  const iAmInSources =
    cited ||
    (mainUrl ? sourcesFound.some((s) => s.includes(normalizeDomain(mainUrl))) : false);
  const shareOfVoice = sourceCount > 0 && iAmInSources ? 1 / sourceCount : 0;

  const competitorResults = checkCompetitors(content, competitors);

  let confidenceScore = 0;
  if (cited) {
    const lower = content.toLowerCase();
    const name = (companyName ?? "").toLowerCase().trim();
    const strongSignals = [
      "industry leader", "best known", "leading", "top choice",
      "highly recommended", "go-to", "number one", "#1", "market leader",
      "standout", "premier", "trusted",
    ];
    const mediumSignals = [
      "popular", "well-known", "notable", "worth", "recommend",
      "good option", "solid choice", "competitive",
    ];
    const hasStrong = strongSignals.some(
      (s) => lower.includes(s) && (name ? lower.indexOf(s) - lower.indexOf(name) < 200 : true)
    );
    const hasMedium = mediumSignals.some(
      (s) => lower.includes(s) && (name ? lower.indexOf(s) - lower.indexOf(name) < 200 : true)
    );
    if (hasStrong) confidenceScore = 5;
    else if (hasMedium) confidenceScore = 3;
    else confidenceScore = 2;
  }

  return {
    level,
    cited,
    citationTag,
    answerPosition,
    sourcesFound,
    sourceCount,
    shareOfVoice,
    competitorResults,
    confidenceScore,
    positionRank: cited ? 1 : null,
  };
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireUser();
  if (authError) return authError;

  const budget = await checkBudget(user.id);
  if (!budget.allowed) {
    return err(`Monthly call limit reached (${budget.count} of ${budget.budget}). Update your limit in AI Usage.`, 429, "BUDGET_EXCEEDED");
  }

  try {
    const ip = getClientIp(req);
    const rate = await checkRateLimit(ip, "geo/run", RATE_LIMITS["geo/run"]);
    if (!rate.ok) {
      return err("Rate limit exceeded. Try again later.", 429, "RATE_LIMIT_EXCEEDED");
    }

    const parsed = await parseBody(req, geoRunSchema);
    if (parsed.error) return parsed.error;

    const body = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const perplexityKey = process.env.PERPLEXITY_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

    // Resolve which LLMs to test. GPT requires OPENAI_API_KEY.
    const requestedLLMs: import("@/types").GeoLLMId[] =
      body.targetLLMs && body.targetLLMs.length > 0
        ? (body.targetLLMs as import("@/types").GeoLLMId[])
        : ["gpt"];

    const availableLLMs: import("@/types").GeoLLMId[] = [];
    const skippedLLMs: import("@/types").GeoLLMId[] = [];
    for (const llm of requestedLLMs) {
      if (llm === "gpt" && apiKey) availableLLMs.push("gpt");
      else if (llm === "perplexity" && perplexityKey) availableLLMs.push("perplexity");
      else if (llm === "claude" && anthropicKey) availableLLMs.push("claude");
      else skippedLLMs.push(llm);
    }

    if (availableLLMs.length === 0) {
      return err(
        "No LLM API keys available. Set OPENAI_API_KEY, PERPLEXITY_API_KEY, or ANTHROPIC_API_KEY.",
        500
      );
    }

    const mode = body.mode ?? "repeat";
    const runsPerPrompt =
      mode === "repeat" ? Math.min(10, Math.max(1, body.runsPerPrompt ?? 1)) : 1;
    const variantsPerPrompt =
      mode === "variants" ? Math.min(5, Math.max(1, body.variantsPerPrompt ?? 5)) : 1;

    const mainUrl = body.mainUrl ?? undefined;
    const companyName = body.companyName ?? undefined;
    const competitors: GeoCompetitorInput[] = body.competitors ?? [];
    const brandEntities: GeoBrandEntity[] =
      (body.brandEntities && body.brandEntities.length > 0)
        ? body.brandEntities.map((e) => ({ name: e.name, type: (e.type as "main" | "brand" | "sub_entity") || "brand" }))
        : companyName
          ? [{ name: companyName, type: "main" as const }]
          : [];
    const useJudge = brandEntities.length > 0;
    const useWebSearch = body.useWebSearch !== false;
    const geoModel = useWebSearch ? GEO_MODEL : JUDGE_MODEL;

    // Helper: call the appropriate LLM based on ID
    const callLLM = async (
      llmId: import("@/types").GeoLLMId,
      prompt: string,
      temperature?: number
    ): Promise<LLMCallResult> => {
      if (llmId === "perplexity") return callGeoPerplexity(prompt, perplexityKey!);
      if (llmId === "claude") return callGeoClaude(prompt, anthropicKey!);
      // Search preview models reject temperature — only pass it for knowledge-mode (no web search)
      return callGeoGPT(prompt, GEO_SYSTEM, apiKey!, geoModel, useWebSearch ? undefined : temperature);
    };

    if (mode === "variants" && !apiKey) {
      return err("Variants mode requires OPENAI_API_KEY to be set.", 500);
    }

    const results: GeoPromptResult[] = [];
    let totalLatencyMs = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const promptResults = await Promise.all(
      body.prompts.map(async (seedPrompt, rank): Promise<GeoPromptResult> => {
      if (mode === "repeat") {
        const repeatRuns: GeoVariantRun[] = [];
        let citedCount = 0;
        let latencyMs = 0;
        let inputTokens = 0;
        let outputTokens = 0;
        const allSources = new Set<string>();
        const allCompetitorCounts: Record<string, number> = {};
        let confidenceSum = 0;
        // Per-LLM citation tracking for citationRateByLLM
        const llmCitedCounts: Partial<Record<import("@/types").GeoLLMId, number>> = {};
        const llmRunCounts: Partial<Record<import("@/types").GeoLLMId, number>> = {};
        for (const llmId of availableLLMs) {
          llmCitedCounts[llmId] = 0;
          llmRunCounts[llmId] = 0;
        }

        const repeatResults = await Promise.all(
          Array.from({ length: runsPerPrompt }, async (_, r) => {
            // Fan out across all available LLMs per run
            const llmResults = await Promise.allSettled(
              availableLLMs.map((llmId) => callLLM(llmId, seedPrompt, 1.5).then((res) => ({ llmId, res })))
            );
            // Collect error messages from failed calls to surface in UI
            const llmErrors: string[] = [];
            for (const r of llmResults) {
              if (r.status === "rejected") {
                const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
                llmErrors.push(msg);
                console.error("[geo/run] LLM call failed:", msg);
              }
            }
            // Use GPT result as primary (or first available) for variant run entry
            const primaryResult = llmResults
              .filter((r): r is PromiseFulfilledResult<{ llmId: import("@/types").GeoLLMId; res: LLMCallResult }> => r.status === "fulfilled")
              .find((r) => r.value.llmId === "gpt") ??
              llmResults.find((r): r is PromiseFulfilledResult<{ llmId: import("@/types").GeoLLMId; res: LLMCallResult }> => r.status === "fulfilled");

            const errorContent = llmErrors.length > 0 && !primaryResult
              ? `[LLM Error] ${llmErrors.join(" | ")}`
              : "";
            const llm = primaryResult?.value.res ?? { content: errorContent, promptTokens: 0, completionTokens: 0, latencyMs: 0 };
            const allLLMResults = llmResults
              .filter((r): r is PromiseFulfilledResult<{ llmId: import("@/types").GeoLLMId; res: LLMCallResult }> => r.status === "fulfilled")
              .map((r) => r.value);

            // Accumulate per-LLM token counts and compute per-LLM citations
            const perLLMCited: Partial<Record<import("@/types").GeoLLMId, boolean>> = {};
            for (const { llmId, res: llmRes } of allLLMResults) {
              totalInputTokens += llmRes.promptTokens;
              totalOutputTokens += llmRes.completionTokens;
              totalLatencyMs += llmRes.latencyMs;
              llmRunCounts[llmId] = (llmRunCounts[llmId] ?? 0) + 1;
              const { level } = getCitationLevel(llmRes.content, mainUrl, companyName);
              perLLMCited[llmId] = level !== "none";
            }

            let judgeResult: CitationJudgeResult | undefined;
            if (useJudge && apiKey) {
              const heuristic = getCitationLevel(llm.content, mainUrl, companyName);
              if (heuristic.level === "none") {
                try {
                  judgeResult = await callCitationJudge(
                    llm.content,
                    companyName,
                    brandEntities,
                    mainUrl,
                    apiKey
                  );
                } catch {
                  judgeResult = undefined;
                }
              } else {
                judgeResult = {
                  cited: true,
                  citationLevel: heuristic.level,
                  citationTag: heuristic.level === "direct_page" ? "URL" : heuristic.level === "site" ? "Domain" : "Brand",
                };
              }
            }

            const analysis = analyzeAnswer(
              llm.content,
              mainUrl,
              companyName,
              competitors,
              judgeResult ? { judgeResult, brandEntities } : undefined
            );

            // Sync primary LLM's perLLMCited with the judge-enhanced analysis result
            const primaryLLMId = primaryResult?.value.llmId ?? "gpt";
            perLLMCited[primaryLLMId] = analysis.cited;

            return { llm, analysis, runIndex: r, perLLMCited };
          })
        );

        for (const { llm, analysis, runIndex, perLLMCited } of repeatResults) {
          latencyMs += llm.latencyMs;
          inputTokens += llm.promptTokens;
          outputTokens += llm.completionTokens;

          if (analysis.cited) citedCount++;
          // Track per-LLM citation counts
          for (const [llmId, cited] of Object.entries(perLLMCited) as [import("@/types").GeoLLMId, boolean][]) {
            if (cited) llmCitedCounts[llmId] = (llmCitedCounts[llmId] ?? 0) + 1;
          }
          analysis.sourcesFound.forEach((s) => allSources.add(s));
          confidenceSum += analysis.confidenceScore;
          for (const cr of analysis.competitorResults) {
            allCompetitorCounts[cr.name] =
              (allCompetitorCounts[cr.name] ?? 0) + (cr.cited ? 1 : 0);
          }

          repeatRuns.push({
            prompt: `Run ${runIndex + 1}`,
            snippet:
              llm.content.slice(0, SNIPPET_LEN) +
              (llm.content.length > SNIPPET_LEN ? "…" : ""),
            fullResponse: llm.content,
            cited: analysis.cited,
            citationLevel: analysis.level,
            citationTag: analysis.citationTag,
            positionRank: analysis.positionRank,
            answerPosition: analysis.answerPosition,
            sourcesFound: analysis.sourcesFound,
            competitorResults: analysis.competitorResults,
            confidenceScore: analysis.confidenceScore,
          });
        }

        const citationRate =
          runsPerPrompt > 0 ? Math.round((citedCount / runsPerPrompt) * 100) : 0;
        const allSourcesArr = [...allSources];
        const sourceCount = allSourcesArr.length;
        const iAmInSources =
          citedCount > 0 ||
          (mainUrl ? allSourcesArr.some((s) => s.includes(normalizeDomain(mainUrl))) : false);
        const shareOfVoice = sourceCount > 0 && iAmInSources ? 1 / sourceCount : 0;

        const competitorResults: GeoCompetitorResult[] = competitors.map((c) => ({
          name: c.name,
          url: c.url,
          cited: (allCompetitorCounts[c.name] ?? 0) > 0,
          citationLevel:
            (allCompetitorCounts[c.name] ?? 0) > 0 ? ("brand" as GeoCitationLevel) : "none",
        }));

        // Build per-LLM citation rates
        const citationRateByLLM: Partial<Record<import("@/types").GeoLLMId, number>> = {};
        for (const llmId of availableLLMs) {
          const runs = llmRunCounts[llmId] ?? 0;
          const cited = llmCitedCounts[llmId] ?? 0;
          citationRateByLLM[llmId] = runs > 0 ? Math.round((cited / runs) * 100) : 0;
        }
        const llmRates = Object.values(citationRateByLLM) as number[];
        const avgCitationRateMultiLLM = llmRates.length > 0
          ? Math.round(llmRates.reduce((a, b) => a + b, 0) / llmRates.length)
          : citationRate;

        return {
          prompt: seedPrompt,
          citationRateByLLM,
          avgCitationRate: avgCitationRateMultiLLM,
          rank: rank + 1,
          lastRun: new Date().toISOString(),
          cited: citedCount > 0,
          latencyMs,
          inputTokens,
          outputTokens,
          runs: runsPerPrompt,
          citedCount,
          mode: "repeat",
          variantRuns: repeatRuns,
          estimatedCostUsd: estimateCost(inputTokens, outputTokens),
          answerPosition: repeatRuns.find((v) => v.cited)?.answerPosition ?? repeatRuns[0]?.answerPosition ?? null,
          sourceCount,
          shareOfVoice,
          sourcesFound: allSourcesArr,
          competitorResults,
          confidenceScore: runsPerPrompt > 0 ? Math.round(confidenceSum / runsPerPrompt) : 0,
        };
      } else {
        // Variants mode — rephrasing uses non-search model (no web search needed)
        let variantsRes: LLMCallResult;
        try {
          variantsRes = await callGeoGPT(
            `Generate exactly ${variantsPerPrompt} different phrasings of this search query. Same intent and topic, different wording only. Reply with only the ${variantsPerPrompt} questions, one per line, no numbering or bullets.\n\nSearch query: "${seedPrompt}"`,
            `You are a helpful assistant. Output only the list of questions, one per line. Each line must be a rephrasing of the same search query, not a different topic.`,
            apiKey!,
            JUDGE_MODEL
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[geo/run] Variant rephrasing failed:", msg);
          variantsRes = { content: seedPrompt, promptTokens: 0, completionTokens: 0, latencyMs: 0 };
        }
        totalLatencyMs += variantsRes.latencyMs;
        totalInputTokens += variantsRes.promptTokens;
        totalOutputTokens += variantsRes.completionTokens;

        const variantLines = variantsRes.content
          .split(/\r?\n/)
          .map((s) => s.replace(/^\s*[\d.)\-•]\s*/, "").trim())
          .filter(Boolean);
        const variants =
          variantLines.length >= variantsPerPrompt
            ? variantLines.slice(0, variantsPerPrompt)
            : variantLines.length > 0
              ? variantLines
              : [seedPrompt];

        const variantRuns: GeoVariantRun[] = [];
        let citedCount = 0;
        let latencyMs = 0;
        let inputTokens = 0;
        let outputTokens = 0;
        const allSources = new Set<string>();
        let confidenceSum = 0;
        const allCompetitorCounts: Record<string, number> = {};

        const variantResults = await Promise.all(
          variants.map(async (variantPrompt) => {
            // Use primary LLM (GPT if available, else first available) for variants mode
            let llm: LLMCallResult;
            try {
              llm = await callLLM(availableLLMs[0] ?? "gpt", variantPrompt);
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              console.error("[geo/run] Variant LLM call failed:", msg);
              llm = { content: `[LLM Error] ${msg}`, promptTokens: 0, completionTokens: 0, latencyMs: 0 };
            }

            let judgeResult: CitationJudgeResult | undefined;
            if (useJudge && apiKey) {
              const heuristic = getCitationLevel(llm.content, mainUrl, companyName);
              if (heuristic.level === "none") {
                try {
                  judgeResult = await callCitationJudge(
                    llm.content,
                    companyName,
                    brandEntities,
                    mainUrl,
                    apiKey
                  );
                } catch {
                  judgeResult = undefined;
                }
              } else {
                judgeResult = {
                  cited: true,
                  citationLevel: heuristic.level,
                  citationTag: heuristic.level === "direct_page" ? "URL" : heuristic.level === "site" ? "Domain" : "Brand",
                };
              }
            }

            const analysis = analyzeAnswer(
              llm.content,
              mainUrl,
              companyName,
              competitors,
              judgeResult ? { judgeResult, brandEntities } : undefined
            );

            return { llm, analysis, variantPrompt };
          })
        );

        for (const { llm, analysis, variantPrompt } of variantResults) {
          latencyMs += llm.latencyMs;
          inputTokens += llm.promptTokens;
          outputTokens += llm.completionTokens;
          totalLatencyMs += llm.latencyMs;
          totalInputTokens += llm.promptTokens;
          totalOutputTokens += llm.completionTokens;

          if (analysis.cited) citedCount++;
          analysis.sourcesFound.forEach((s) => allSources.add(s));
          confidenceSum += analysis.confidenceScore;
          for (const cr of analysis.competitorResults) {
            allCompetitorCounts[cr.name] =
              (allCompetitorCounts[cr.name] ?? 0) + (cr.cited ? 1 : 0);
          }

          variantRuns.push({
            prompt: variantPrompt,
            snippet:
              llm.content.slice(0, SNIPPET_LEN) +
              (llm.content.length > SNIPPET_LEN ? "…" : ""),
            fullResponse: llm.content,
            cited: analysis.cited,
            citationLevel: analysis.level,
            citationTag: analysis.citationTag,
            positionRank: analysis.positionRank,
            answerPosition: analysis.answerPosition,
            sourcesFound: analysis.sourcesFound,
            competitorResults: analysis.competitorResults,
            confidenceScore: analysis.confidenceScore,
          });
        }

        const citationRate =
          variantRuns.length > 0
            ? Math.round((citedCount / variantRuns.length) * 100)
            : 0;
        const allSourcesArr = [...allSources];
        const sourceCount = allSourcesArr.length;
        const iAmInSources =
          citedCount > 0 ||
          (mainUrl ? allSourcesArr.some((s) => s.includes(normalizeDomain(mainUrl))) : false);
        const shareOfVoice = sourceCount > 0 && iAmInSources ? 1 / sourceCount : 0;

        const competitorResults: GeoCompetitorResult[] = competitors.map((c) => ({
          name: c.name,
          url: c.url,
          cited: (allCompetitorCounts[c.name] ?? 0) > 0,
          citationLevel:
            (allCompetitorCounts[c.name] ?? 0) > 0 ? ("brand" as GeoCitationLevel) : "none",
        }));

        // For variants mode, attribute all runs to the primary LLM used
        const primaryLLMId = availableLLMs[0] ?? "gpt";
        return {
          prompt: seedPrompt,
          citationRateByLLM: { [primaryLLMId]: citationRate } as Partial<Record<import("@/types").GeoLLMId, number>>,
          avgCitationRate: citationRate,
          rank: rank + 1,
          lastRun: new Date().toISOString(),
          cited: citedCount > 0,
          latencyMs,
          inputTokens,
          outputTokens,
          runs: variantRuns.length,
          citedCount,
          mode: "variants",
          variantRuns,
          estimatedCostUsd: estimateCost(
            inputTokens + variantsRes.promptTokens,
            outputTokens + variantsRes.completionTokens
          ),
          answerPosition: variantRuns.find((v) => v.cited)?.answerPosition ?? null,
          sourceCount,
          shareOfVoice,
          sourcesFound: allSourcesArr,
          competitorResults,
          confidenceScore:
            variantRuns.length > 0 ? Math.round(confidenceSum / variantRuns.length) : 0,
        };
      }
    })
    );
    results.push(...promptResults);

    const totalEstimatedCostUsd = estimateCost(totalInputTokens, totalOutputTokens);

    const runId = `geo-${Date.now()}`;
    const response: GeoRunResponse = {
      results,
      runId,
      totalLatencyMs,
      totalInputTokens,
      totalOutputTokens,
      totalEstimatedCostUsd,
      model: availableLLMs.join("+") || geoModel,
      skippedLLMs: skippedLLMs.length > 0 ? skippedLLMs : undefined,
    };

    // Persist run history — must await on serverless (Vercel) so the function
    // doesn't terminate before the DB write completes.
    const avgCitationRate =
      results.length > 0
        ? results.reduce((s, r) => s + r.avgCitationRate, 0) / results.length
        : 0;
    try {
      await dbSaveGeoRun(user.id, {
        runId,
        companyName,
        mainUrl,
        prompts: body.prompts,
        results,
        model: response.model,
        targetLLMs: availableLLMs,
        avgCitationRate,
        totalEstimatedCostUsd,
        totalLatencyMs,
      });
    } catch (e) {
      console.warn("[geo/run] Failed to save run history:", e);
    }

    return ok(response);
  } catch (error) {
    logError("/api/geo/run", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while running GEO benchmark.";
    return err(message, 500);
  }
}

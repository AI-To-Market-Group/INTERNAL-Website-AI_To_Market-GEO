import type {
  Opportunity,
  OpportunitySource,
  ConfidenceLevel,
  GenerateEyeContentTopicsResponse,
} from "@/types";
import type { TopicInTheme } from "@/types";
import { CONTENT_THEME_IDS } from "@/types";
import { generateTopicsCompetitors } from "./api";
import { normalizeOpportunity } from "./opportunity";

export const COMPETITOR_TOPICS_QUERY_KEY = ["competitor-topics-api"] as const;

type SourceTag = "trend" | "gap" | "date";

interface FlatTopic {
  title: string;
  theme: string;
  score: number;
  rank: number;
  content_intents: string[];
  source: SourceTag;
  /** API returns "Strong" | "Good" | "Medium" | "Low" | "Weak" */
  confidence?: string;
  /** For date source: "Key Date: Halloween J-16" */
  whyNowLabel?: string;
}

/** Map API source ("competitors" | "trends" | "date") to SourceTag */
function apiSourceToTag(apiSource: string): SourceTag {
  if (apiSource === "competitors") return "gap";
  if (apiSource === "trends") return "trend";
  if (apiSource === "date") return "date";
  return "gap";
}

function flattenThemes(
  themes: Record<string, TopicInTheme[]>,
  source: SourceTag
): FlatTopic[] {
  const out: FlatTopic[] = [];
  const themeOrder = Object.keys(themes).length ? Object.keys(themes) : [...CONTENT_THEME_IDS];
  for (const themeName of themeOrder) {
    const list = themes[themeName];
    if (!list?.length) continue;
    for (const t of list) {
      out.push({
        title: t.topic,
        theme: themeName,
        score: t.score,
        rank: t.rank,
        content_intents: t.content_intents ?? [],
        source,
        confidence: t.confidence,
      });
    }
  }
  return out;
}

function contentBriefFromSource(source: SourceTag, whyNowLabel?: string): string {
  if (source === "date" && whyNowLabel) return whyNowLabel;
  if (source === "gap") return "La concurrence exploite ce topic, pas nous.";
  if (source === "trend") return "Rising trend";
  return "Opportunity identified by the radar.";
}

function sourceToOpportunitySource(s: SourceTag): OpportunitySource {
  if (s === "date") return "date";
  if (s === "gap") return "gap";
  return "trend";
}

function priorityFromScore(score: number): "haute" | "moyenne" | "basse" {
  if (score >= 70) return "haute";
  if (score >= 40) return "moyenne";
  return "basse";
}

function confidenceFromApi(c: string): ConfidenceLevel {
  const map: Record<string, ConfidenceLevel> = {
    Strong: "strong",
    Good: "good",
    Medium: "medium",
    Low: "low",
    Weak: "low",
  };
  return map[c] ?? "medium";
}

/**
 * Builds the opportunities list from the APIs:
 * - POST /generate-eye-content-topics/competitors (source "competitors")
 * - Structure: source, competitor_gap_count, generated_topics.themes
 * - Each topic includes topic, score, rank, content_intents, confidence
 */
/**
 * Transforms raw generate-eye-content-topics response into Opportunity list.
 */
export function transformCompetitorResponseToOpportunities(
  res: GenerateEyeContentTopicsResponse
): Opportunity[] {
  const apiSource = res.source ?? "competitors";
  const sourceTag = apiSourceToTag(apiSource);

  const competitorTopics = flattenThemes(
    res.generated_topics?.themes ?? {},
    sourceTag
  );

  const sorted = [...competitorTopics].sort((a, b) => b.score - a.score);

  return sorted.map((a, index) => {
    const id = `api-${a.source}-${a.theme}-${a.rank}-${index}`.replace(/\s+/g, "-");
    // type TREND for semrush, SEO_GAP for competitors (aligned with generate-eye-content-topics + analyze-topic API)
    const type = a.source === "trend" ? "TREND" : "SEO_GAP";
    const raw: Opportunity = {
      id,
      title: a.title,
      type,
      theme: a.theme,
      intents: a.content_intents,
      sources: [sourceToOpportunitySource(a.source)],
      score: a.score,
      priority: priorityFromScore(a.score),
      content_brief: contentBriefFromSource(a.source, a.whyNowLabel),
      metrics: {
        topic_quality: undefined,
        coverage_potential: Math.min(85, 35 + (a.score % 45)),
        confidence: a.confidence ? confidenceFromApi(a.confidence) : "medium",
      } as Opportunity["metrics"],
    };
    return normalizeOpportunity(raw);
  });
}

/** Calls the API and transforms the response (for standalone use). */
export async function fetchOpportunitiesFromApis(): Promise<Opportunity[]> {
  const res = await generateTopicsCompetitors();
  return transformCompetitorResponseToOpportunities(res);
}


import type { Opportunity, OpportunitySource, PriorityLevel, ConfidenceLevel } from "@/types";

/**
 * Normalize API opportunity (legacy or new spec) for UI consumption.
 * Derives theme, intents, sources, score, priority, content_brief from legacy fields when needed.
 */
export function normalizeOpportunity(raw: Opportunity): Opportunity {
  const score = raw.score ?? raw.impact_score ?? 0;
  const priority: PriorityLevel =
    raw.priority ?? (score >= 70 ? "haute" : score >= 40 ? "moyenne" : "basse");
  const sources: OpportunitySource[] =
    raw.sources?.length
      ? raw.sources
      : raw.type === "SEASONAL"
        ? ["date"]
        : raw.type === "TREND"
          ? ["trend"]
          : raw.type === "SEO_GAP"
            ? ["gap"]
            : ["date"];
  const theme = raw.theme ?? raw.tags?.[0] ?? "—";
  // Generate intents based on type if not provided
  const intents = raw.intents?.length
    ? raw.intents
    : raw.type === "SEASONAL"
      ? ["lifestyle", "awareness"]
      : raw.type === "TREND"
        ? ["education", "lifestyle"]
        : raw.type === "SEO_GAP"
          ? raw.subtype === "CONTENT_GAP"
            ? ["education", "comparison"]
            : raw.subtype === "ZOMBIE_CONTENT"
              ? ["education", "faq"]
              : ["education", "buying_guidance"]
          : ["education"];
  const content_brief =
    raw.content_brief ?? raw.driver_label ?? "Opportunity identified by the radar.";

  const competitor_articles =
    raw.competitor_articles?.length ?
      raw.competitor_articles
    : (raw.type === "SEO_GAP" || raw.type === "TREND") ?
      [
        { source: "misterspex.fr", title: raw.title + " (concurrent)", link: "https://misterspex.fr" },
        { source: "opticien-atol.fr", title: "Competitor article on the theme", link: "https://opticien-atol.fr" },
      ]
    : undefined;

  // Generate topic_quality from existing metrics or derive from score (API: analyze-topic returns topic_quality)
  const topic_quality: number =
    typeof raw.metrics?.topic_quality === "number"
      ? raw.metrics.topic_quality
      : Math.min(100, Math.max(50, score - 5 + (raw.id?.length ?? 0) % 15));

  // Generate coverage_potential from existing metrics or derive from score
  const coverage_potential =
    raw.metrics?.coverage_potential ??
    (raw.metrics?.keyword_difficulty != null
      ? 100 - raw.metrics.keyword_difficulty // Lower difficulty = higher potential
      : Math.min(85, 35 + (score % 45)));

  // Generate confidence: rebalance (fewer good, more strong/medium)
  const apiConfidence = raw.metrics?.confidence;
  let confidence: ConfidenceLevel =
    apiConfidence ?? (score >= 82 ? "strong" : score >= 68 ? "good" : score >= 50 ? "medium" : "low");
  if (apiConfidence) {
    if (score >= 82 && (apiConfidence === "good" || apiConfidence === "medium"))
      confidence = "strong";
    else if (score < 68 && score >= 50 && apiConfidence === "good")
      confidence = "medium";
    else if (score < 50 && (apiConfidence === "good" || apiConfidence === "medium"))
      confidence = "low";
  }

  const m = raw.metrics;
  const metrics: NonNullable<Opportunity["metrics"]> = {
    search_volume: m?.search_volume ?? null,
    keyword_difficulty: m?.keyword_difficulty ?? null,
    current_position: m?.current_position ?? null,
    target_position: m?.target_position ?? null,
    trend_percentage: m?.trend_percentage ?? null,
    last_updated_days: m?.last_updated_days ?? null,
    days_until_event: m?.days_until_event ?? null,
    event_name: m?.event_name ?? null,
    category: m?.category ?? null,
    topic_quality,
    coverage_potential: coverage_potential ?? null,
    confidence,
  };

  return {
    ...raw,
    theme,
    intents,
    sources,
    score,
    priority,
    content_brief,
    impact_score: raw.impact_score ?? score,
    competitor_articles,
    metrics,
  };
}

export function normalizeOpportunities(list: Opportunity[]): Opportunity[] {
  return list.map(normalizeOpportunity);
}

import { useMutation } from "@tanstack/react-query";
import { analyzeTopic } from "@/lib/api";
import type { FlashAuditResponse } from "@/types";

/** Maps AnalyzeTopicResponse to FlashAuditResponse for compatibility with FlashAuditModal. */
function mapAnalyzeToFlashAudit(
  title: string,
  res: { title: string; seo_metrics: { topic_quality: number; coverage_potential: number; confidence: string } }
): FlashAuditResponse {
  const conf = res.seo_metrics.confidence.toLowerCase();
  const recommendation: "high" | "medium" | "low" =
    conf === "good" || conf === "strong" ? "high" : conf === "medium" ? "medium" : "low";
  return {
    topic: title,
    search_volume: 0,
    keyword_difficulty: 0,
    impact_score: res.seo_metrics.topic_quality,
    recommendation,
    existing_article: null,
    competitor_positions: [],
    suggested_titles: [],
  };
}

export const useFlashAudit = () => {
  return useMutation<FlashAuditResponse, Error, string>({
    mutationFn: async (topic: string) => {
      const res = await analyzeTopic(topic);
      return mapAnalyzeToFlashAudit(topic, res);
    },
  });
};

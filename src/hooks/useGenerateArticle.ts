"use client";

import { useState, useCallback } from "react";
import { streamValidatePlan } from "@/lib/api";
import { mapGenerateArticleResponseToDraft } from "@/lib/article-builder-utils";
import type { ArticleDraft, OutlineSection, QualityFlag, GeoScore, BrandVoiceStatus } from "@/types";

export interface GenerateArticleInput {
  outline: OutlineSection[];
  articleTitle: string;
  opportunityId?: string;
}

export interface GenerateArticleResult {
  draft: ArticleDraft;
  qualityFlags: QualityFlag[];
  geoScore: GeoScore | null;
  brandVoiceStatus: BrandVoiceStatus | undefined;
}

export function useGenerateArticle() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const generate = useCallback(
    async (
      input: GenerateArticleInput,
      onDone: (result: GenerateArticleResult) => void,
      onError: (err: Error) => void
    ) => {
      if (!input.opportunityId) {
        onError(new Error("opportunityId is required"));
        return;
      }
      setIsStreaming(true);
      setStreamingText("");
      try {
        await streamValidatePlan(
          input.opportunityId,
          { outline: input.outline },
          (chunk) => setStreamingText((prev) => prev + chunk),
          (article, qualityFlags, geoScore, brandVoiceStatus) => {
            onDone({
              draft: mapGenerateArticleResponseToDraft(article),
              qualityFlags,
              geoScore,
              brandVoiceStatus,
            });
          }
        );
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setIsStreaming(false);
        setStreamingText("");
      }
    },
    []
  );

  return { generate, isStreaming, streamingText };
}

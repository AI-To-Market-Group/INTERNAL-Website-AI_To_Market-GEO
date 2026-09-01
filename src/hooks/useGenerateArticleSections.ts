"use client";

import { useMutation } from "@tanstack/react-query";
import { postGenerateOutline } from "@/lib/api";
import type { GenerateArticleSectionsResponse } from "@/types";

export type GenerateArticleSectionsInput = {
  topicTitle: string;
  opportunityId?: string;
  theme?: string;
  intents?: string[];
  contentBrief?: string;
  justificationSignals?: string[];
  tags?: string[];
};

export function useGenerateArticleSections() {
  return useMutation<
    GenerateArticleSectionsResponse,
    Error,
    GenerateArticleSectionsInput
  >({
    mutationFn: async ({ topicTitle, opportunityId, theme, intents, contentBrief, justificationSignals, tags }) => {
      if (!opportunityId) {
        throw new Error("opportunityId is required to generate outline");
      }
      return postGenerateOutline(opportunityId, {
        topic_title: topicTitle,
        theme,
        intents,
        content_brief: contentBrief,
        justification_signals: justificationSignals,
        tags,
      });
    },
  });
}

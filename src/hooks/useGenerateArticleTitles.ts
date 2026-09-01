"use client";

import { useMutation } from "@tanstack/react-query";
import { generateArticleTitles } from "@/lib/api";
import { useApiMode } from "./useApiMode";
import type { GenerateArticleTitlesResponse } from "@/types";

/**
 * Generates 3 article titles from user input
 * (keywords, title, description, ideas, etc.).
 */
export function useGenerateArticleTitles() {
  const { getEndpointMode } = useApiMode();
  const mode = getEndpointMode("keywords");
  const shouldUseApi = mode === "api";

  return useMutation<
    GenerateArticleTitlesResponse,
    Error,
    { userInput: string; language?: string }
  >({
    mutationFn: async ({ userInput, language = "en" }) => {
      if (shouldUseApi) {
        return generateArticleTitles(userInput, language);
      }
      // Mock fallback when API not configured
      await new Promise((r) => setTimeout(r, 800));
      const words = userInput.split(/\s+/).filter(Boolean).slice(0, 3);
      return {
        titles: [
          userInput.length > 20 ? userInput : `Complete guide: ${words.join(" ")}`,
          `Everything you need to know about ${words[0] || "this topic"} — practical tips`,
          `${words[0] || "Discover"}: our recommendations and insights`,
        ],
      };
    },
  });
}

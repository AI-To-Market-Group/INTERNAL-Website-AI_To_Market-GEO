"use client";

import { useMutation } from "@tanstack/react-query";
import { generateTopicsFromKeywords } from "@/lib/api";
import type { GenerateEyeContentFromKeywordsResponse } from "@/types";

export function useFromKeywords() {
  return useMutation<
    GenerateEyeContentFromKeywordsResponse,
    Error,
    { keywords: string[]; language?: string }
  >({
    mutationFn: async ({ keywords, language = "en" }) => {
      return generateTopicsFromKeywords(keywords, language);
    },
  });
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { analyzeTopic } from "@/lib/api";
import type { AnalyzeTopicResponse } from "@/types";

export function useAnalyzeTitle() {
  return useMutation<AnalyzeTopicResponse, Error, string>({
    mutationFn: (title: string) => analyzeTopic(title),
  });
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { postReviseSection } from "@/lib/api";
import type { ReviseArticleSectionRequest, ReviseArticleSectionResponse } from "@/types";

export type ReviseSectionInput = ReviseArticleSectionRequest & { opportunityId?: string };

export function useReviseArticleSection() {
  return useMutation<ReviseArticleSectionResponse, Error, ReviseSectionInput>({
    mutationFn: async (body) => {
      const { opportunityId, ...apiBody } = body;
      if (!opportunityId) {
        throw new Error("opportunityId is required to revise section");
      }
      return postReviseSection(opportunityId, apiBody);
    },
  });
}

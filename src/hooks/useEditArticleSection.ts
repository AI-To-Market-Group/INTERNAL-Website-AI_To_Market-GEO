"use client";

import { useMutation } from "@tanstack/react-query";
import { postEditParagraph } from "@/lib/api";
import type { EditArticleSectionRequest, EditArticleSectionResponse } from "@/types";

export type EditArticleSectionInput = EditArticleSectionRequest & { opportunityId?: string };

export function useEditArticleSection() {
  return useMutation<EditArticleSectionResponse, Error, EditArticleSectionInput>({
    mutationFn: async (body) => {
      const { opportunityId, ...apiBody } = body;
      if (!opportunityId) {
        throw new Error("opportunityId is required to edit paragraph");
      }
      return postEditParagraph(opportunityId, apiBody);
    },
  });
}

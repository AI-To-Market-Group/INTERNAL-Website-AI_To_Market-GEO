import { useMutation } from "@tanstack/react-query";
import type { GenerateContentResponse } from "@/types";

/** No backend API for generate-content workflow. Throws when called. */
export const useGenerateContent = () => {
  return useMutation<GenerateContentResponse, Error, string>({
    mutationFn: async () => {
      throw new Error("Generate content API is not implemented");
    },
  });
};

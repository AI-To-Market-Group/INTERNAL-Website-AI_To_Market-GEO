"use client";

import { useQuery } from "@tanstack/react-query";
import { normalizeOpportunities } from "@/lib/opportunity";
import type { OpportunitiesResponse } from "@/types";

export const useOpportunities = () => {
  return useQuery<OpportunitiesResponse>({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const res = await fetch("/api/opportunities");
      if (!res.ok) throw new Error("Failed to fetch opportunities");
      const json = (await res.json()) as OpportunitiesResponse;
      return {
        ...json,
        data: normalizeOpportunities(json.data),
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

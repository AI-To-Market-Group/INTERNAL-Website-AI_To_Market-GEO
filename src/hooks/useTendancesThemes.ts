"use client";

import { useQuery } from "@tanstack/react-query";
import { getHarvestEyeTopics, getGenerateEyeContentTopics } from "@/lib/api";
import type {
  HarvestEyeTopicsResponse,
  GenerateEyeContentTopicsResponse,
} from "@/types";

export function useTendancesThemes() {
  const harvest = useQuery<HarvestEyeTopicsResponse>({
    queryKey: ["tendances", "harvest-eye-topics"],
    queryFn: () => getHarvestEyeTopics(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const generated = useQuery<GenerateEyeContentTopicsResponse>({
    queryKey: ["tendances", "generate-eye-content-topics"],
    queryFn: () => getGenerateEyeContentTopics(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const refetch = () => {
    void harvest.refetch();
    void generated.refetch();
  };

  return {
    harvestTopics: harvest.data ?? null,
    generatedTopics: generated.data ?? null,
    isLoading: harvest.isLoading || generated.isLoading,
    isFetching: harvest.isFetching || generated.isFetching,
    isError: harvest.isError || generated.isError,
    refetch,
  };
}

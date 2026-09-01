"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getBrandBlogsRecent,
  getCompetitorsBlogsRecent,
  getCompetitorTopicGapsLatest,
  generateTopicsCompetitors,
} from "@/lib/api";
import { COMPETITOR_TOPICS_QUERY_KEY } from "@/lib/opportunities-from-apis";
import type {
  BrandBlogsRecentResponse,
  CompetitorsBlogsRecentResponse,
  CompetitorTopicGapsResponse,
  GenerateEyeContentTopicsResponse,
} from "@/types";

export function useGapConcurrence() {
  const brandBlogs = useQuery<BrandBlogsRecentResponse>({
    queryKey: ["gap-concurrence", "aitm-blogs-recent"],
    queryFn: () => getBrandBlogsRecent(),
    enabled: false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const competitors = useQuery<CompetitorsBlogsRecentResponse>({
    queryKey: ["gap-concurrence", "competitors-blogs-recent"],
    queryFn: () => getCompetitorsBlogsRecent(),
    enabled: false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const topicGaps = useQuery<CompetitorTopicGapsResponse>({
    queryKey: ["gap-concurrence", "competitor-topic-gaps"],
    queryFn: async () => {
      const res = await getCompetitorTopicGapsLatest();
      if (res && "error" in res) {
        return {
          competitor_only_topics: [],
          shared_high_value_keywords: [],
          error: (res as { error: string }).error,
        };
      }
      return res as CompetitorTopicGapsResponse;
    },
    enabled: false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const competitorTopicsByTheme = useQuery<GenerateEyeContentTopicsResponse>({
    queryKey: [...COMPETITOR_TOPICS_QUERY_KEY],
    queryFn: () => generateTopicsCompetitors(),
    enabled: false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const refetch = () => {
    void brandBlogs.refetch();
    void competitors.refetch();
    void topicGaps.refetch();
    void competitorTopicsByTheme.refetch();
  };

  const refetchTopicGapsOnly = () => {
    void topicGaps.refetch();
  };

  return {
    brandBlogs: brandBlogs.data ?? null,
    competitorsBlogs: competitors.data ?? null,
    topicGaps: topicGaps.data ?? null,
    competitorTopicsByTheme: competitorTopicsByTheme.data ?? null,
    isLoading:
      brandBlogs.isLoading ||
      competitors.isLoading ||
      topicGaps.isLoading ||
      competitorTopicsByTheme.isLoading,
    isFetching:
      brandBlogs.isFetching ||
      competitors.isFetching ||
      topicGaps.isFetching ||
      competitorTopicsByTheme.isFetching,
    isError:
      brandBlogs.isError ||
      competitors.isError ||
      topicGaps.isError ||
      competitorTopicsByTheme.isError,
    refetch,
    refetchTopicGapsOnly,
  };
}

"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getKeywords,
  getDates,
  getOpportunities,
  getBuilderSessions,
  getCompetitorTopicGapsLatest,
  postOpportunitiesRefreshAll,
} from "@/lib/api";
import { normalizeOpportunities } from "@/lib/opportunity";
import type { UserSettings, OpportunitiesResponse } from "@/types";

export function usePrefetchDashboardData() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefetches: Promise<unknown>[] = [];

    prefetches.push(
      queryClient.prefetchQuery({
        queryKey: ["settings"],
        queryFn: async (): Promise<UserSettings> => {
          const [keywordsRes, datesRes] = await Promise.all([
            getKeywords(),
            getDates(),
          ]);
          return {
            seed_keywords: keywordsRes.seed_keywords || [],
            big_dates: datesRes.big_dates || [],
          };
        },
        staleTime: 5 * 60 * 1000,
      })
    );

    prefetches.push(
        queryClient
          .prefetchQuery({
            queryKey: ["opportunities", "api"],
            queryFn: async (): Promise<OpportunitiesResponse> => {
              const cached = await getOpportunities();
              if (!cached.data || cached.data.length === 0) {
                return {
                  meta: {
                    total_opportunities: 0,
                    last_updated: new Date().toISOString(),
                  },
                  data: [],
                };
              }
              return {
                ...cached,
                data: normalizeOpportunities(
                  cached.data as Parameters<typeof normalizeOpportunities>[0]
                ),
              };
            },
            staleTime: 5 * 60 * 1000,
          })
          .then(async () => {
            const data = queryClient.getQueryData<OpportunitiesResponse>(["opportunities", "api"]);
            if (!data?.meta?.last_updated) return;
            const last = new Date(data.meta.last_updated);
            const now = new Date();
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            if (now.getTime() - last.getTime() >= sevenDaysMs) {
              try {
                await postOpportunitiesRefreshAll();
                await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
                await queryClient.invalidateQueries({
                  queryKey: ["gap-concurrence", "competitor-topic-gaps"],
                });
                await queryClient.prefetchQuery({
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
                      return res;
                    },
                  });
              } catch (e) {
                console.error("Auto-refresh opportunities failed:", e);
              }
            }
          })
    );

    prefetches.push(
      queryClient.prefetchQuery({
        queryKey: ["builder-sessions"],
        queryFn: async () => {
          try {
            return await getBuilderSessions();
          } catch {
            return [] as Awaited<ReturnType<typeof getBuilderSessions>>;
          }
        },
        staleTime: 30 * 1000,
      })
    );

    prefetches.push(
      queryClient.prefetchQuery({
        queryKey: ["gap-concurrence", "competitor-topic-gaps"],
        queryFn: async () => {
          try {
            const res = await getCompetitorTopicGapsLatest();
            if (res && "error" in res) {
              return {
                competitor_only_topics: [],
                shared_high_value_keywords: [],
                error: (res as { error: string }).error,
              };
            }
            return res;
          } catch {
            return {
              competitor_only_topics: [],
              shared_high_value_keywords: [],
            };
          }
        },
        staleTime: 5 * 60 * 1000,
      })
    );

    void Promise.all(prefetches);
  }, [queryClient]);
}

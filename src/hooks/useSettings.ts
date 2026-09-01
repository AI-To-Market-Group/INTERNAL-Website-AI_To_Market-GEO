import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getKeywords, patchKeywords, getDates, patchDates, isMockEnvForced } from "@/lib/api";
import { getMockSettings, setMockSettings } from "@/lib/mock-dashboard-data";
import type { UserSettings } from "@/types";

export const useSettings = () => {
  return useQuery<UserSettings>({
    queryKey: ["settings", isMockEnvForced() ? "mock" : "api"],
    queryFn: async () => {
      if (isMockEnvForced()) {
        return getMockSettings();
      }
      try {
        const [keywordsRes, datesRes] = await Promise.all([
          getKeywords(),
          getDates(),
        ]);
        return {
          seed_keywords: keywordsRes.seed_keywords || [],
          big_dates: datesRes.big_dates || [],
        };
      } catch {
        return getMockSettings();
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<UserSettings>) => {
      if (isMockEnvForced()) {
        setMockSettings(settings);
        return getMockSettings();
      }
      const updates: Promise<unknown>[] = [];
      if (settings.seed_keywords !== undefined) {
        updates.push(patchKeywords(settings.seed_keywords));
      }
      if (settings.big_dates !== undefined) {
        updates.push(patchDates(settings.big_dates));
      }
      await Promise.all(updates);
      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
};

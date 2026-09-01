"use client";

import { Target, Users } from "lucide-react";
import type { CompetitorTopicGapsResponse } from "@/types";

interface RadarGapsSectionProps {
  topicGaps: CompetitorTopicGapsResponse | null;
  isLoading: boolean;
  refetch?: () => void;
  isFetching?: boolean;
}

export function RadarGapsSection({
  topicGaps,
  isLoading: gapLoading,
}: RadarGapsSectionProps) {
  if (gapLoading) {
    return (
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Loading gap analysis…</p>
      </div>
    );
  }

  const gaps = topicGaps?.competitor_only_topics ?? [];
  const errorMsg = topicGaps && "error" in topicGaps ? (topicGaps as { error?: string }).error : null;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <Users className="h-5 w-5 text-primary" />
          Competition gap analysis
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Topics covered by competitors but not by AI To Market (site titles vs competitors). These gaps are used to generate article opportunities.
        </p>
      </div>

      {gaps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center">
          <Target className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            {errorMsg ?? "No topics identified yet."}
          </p>
          {!errorMsg && (
            <p className="mt-1 text-xs text-slate-400">
              Opportunities are refreshed automatically every 7 days when you visit the dashboard.
            </p>
          )}
        </div>
      ) : (
        <div className="max-h-[7.5rem] overflow-y-auto">
          <div className="flex flex-col gap-2">
            {gaps.map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
              >
                <Target className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm leading-snug text-slate-700">
                  {g.topic}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

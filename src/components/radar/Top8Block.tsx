"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confidenceLabelFr } from "@/lib/format";
import type { Opportunity } from "@/types";

const TOP_N = 5;

interface Top8BlockProps {
  opportunities: Opportunity[];
  onChoose: (id: string) => void;
  onVoirPlus: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isLoading?: boolean;
  isError?: boolean;
}

function scoreBadgeClass(score: number): string {
  if (score >= 85) return "bg-emerald-500/15 text-emerald-800 border-emerald-200";
  if (score >= 70) return "bg-primary/15 text-foreground border-primary/30";
  if (score >= 50) return "bg-amber-500/10 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export const Top8Block = ({
  opportunities,
  onChoose,
  onVoirPlus,
  onRefresh,
  isRefreshing,
  isLoading,
  isError,
}: Top8BlockProps) => {
  const top5 = opportunities.slice(0, TOP_N);

  return (
    <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
          Top 5 opportunities
        </h2>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-slate-600"
              title="Refresh opportunities"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onVoirPlus} className="text-slate-600">
            See more
          </Button>
        </div>
      </div>

      {isLoading && top5.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg bg-slate-50/80 py-12">
          <p className="text-sm text-slate-500">Loading opportunities…</p>
        </div>
      ) : isError && top5.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-50/80 py-12">
          <p className="text-sm text-slate-600">An error occurred.</p>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={() => onRefresh()}>
              Retry
            </Button>
          )}
        </div>
      ) : top5.length === 0 ? (
        <p className="rounded-lg bg-slate-50/80 py-12 text-center text-sm text-slate-500">
          No opportunities detected this week.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="w-12 py-3 pl-4 pr-2 text-center text-xs font-medium">
                  Rank
                </th>
                <th className="min-w-[200px] py-3 pl-2 pr-2 text-left text-xs font-medium">
                  Title
                </th>
                <th className="w-[10%] py-3 pr-2 text-left text-xs font-medium">
                  Theme
                </th>
                <th className="w-[18%] py-3 pr-2 text-left text-xs font-medium">
                  Context
                </th>
                <th className="w-16 py-3 pr-2 text-center text-xs font-medium tabular-nums">
                  Score
                </th>
                <th className="w-20 py-3 pr-2 text-right text-xs font-medium">
                  Coverage
                </th>
                <th className="w-20 py-3 pr-2 text-left text-xs font-medium">
                  Confidence
                </th>
                <th className="w-[140px] py-3 pl-2 pr-4 text-right text-xs font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {top5.map((opp, index) => {
                const rank = index + 1;
                const score = opp.score ?? opp.impact_score ?? 0;
                const theme = opp.theme ?? "—";
                const contentBrief = opp.content_brief ?? "";
                const coverage = opp.metrics?.coverage_potential ?? null;
                const confidence = confidenceLabelFr(opp.metrics?.confidence ?? undefined);
                const isFirst = rank === 1;

                return (
                  <tr
                    key={opp.id}
                    className={`border-t border-slate-100 transition-colors hover:bg-slate-50/80 ${
                      isFirst ? "bg-slate-50/50" : "bg-white"
                    }`}
                    data-opportunity-id={opp.id}
                  >
                    <td className="py-2.5 pl-4 pr-2 text-center align-middle">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                          isFirst ? "bg-primary text-primary-foreground" : "bg-slate-200/80 text-slate-600"
                        }`}
                      >
                        {rank}
                      </span>
                    </td>
                    <td className="min-w-0 py-2.5 pl-2 pr-2 align-middle">
                      <span className="font-medium text-slate-900 line-clamp-1">{opp.title}</span>
                    </td>
                    <td className="py-2.5 pr-2 align-middle">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                        {theme}
                      </span>
                    </td>
                    <td className="min-w-0 py-2.5 pr-2 align-middle">
                      <span className="text-xs text-slate-600 line-clamp-1">{contentBrief || "—"}</span>
                    </td>
                    <td className="py-2.5 pr-2 text-center align-middle">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums ${scoreBadgeClass(score)}`}
                      >
                        {score}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-right align-middle tabular-nums text-xs text-slate-600">
                      {coverage != null ? coverage : "—"}
                    </td>
                    <td className="py-2.5 pr-2 align-middle text-xs text-slate-600">
                      {confidence}
                    </td>
                    <td className="py-2.5 pl-2 pr-4 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => onChoose(opp.id)}
                        >
                          Choose
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

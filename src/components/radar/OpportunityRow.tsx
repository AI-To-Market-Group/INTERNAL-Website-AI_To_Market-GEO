"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourceBadges } from "./SourceBadges";
import { PriorityChip } from "./PriorityChip";
import { confidenceLabelFr } from "@/lib/format";
import type { Opportunity } from "@/types";

interface OpportunityRowProps {
  opportunity: Opportunity;
  onChoose: (id: string) => void;
}

export const OpportunityRow = ({
  opportunity,
  onChoose,
}: OpportunityRowProps) => {
  const {
    id,
    title,
    theme = "—",
    intents = [],
    sources = [],
    score = 0,
    priority = "moyenne",
    content_brief = "",
    metrics,
  } = opportunity;
  const topicQuality = metrics?.topic_quality ?? null;
  const confidence = confidenceLabelFr(metrics?.confidence ?? undefined);

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
      data-opportunity-id={id}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{content_brief}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="outline" className="text-xs font-medium">
            {theme}
          </Badge>
          {intents.slice(0, 2).map((intent) => (
            <Badge
              key={intent}
              variant="outline"
              className="bg-slate-50 text-xs font-medium text-slate-600"
            >
              {intent}
            </Badge>
          ))}
          <SourceBadges sources={sources} className="flex gap-1" />
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
          <span>
            <span className="font-medium text-slate-500">Quality:</span>{" "}
            {topicQuality ?? "—"}
          </span>
          <span>
            <span className="font-medium text-slate-500">Confiance :</span> {confidence}
          </span>
          {intents.length > 0 && (
            <span>
              <span className="font-medium text-slate-500">Intents :</span>{" "}
              {intents.slice(0, 2).join(", ")}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-900">{score}</span>
          <PriorityChip priority={priority} />
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => onChoose(id)}
          >
            Choisir ce sujet
          </Button>
        </div>
      </div>
    </div>
  );
};

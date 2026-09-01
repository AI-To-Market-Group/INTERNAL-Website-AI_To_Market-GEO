"use client";

import { Button } from "@/components/ui/button";
import { PriorityChip } from "./PriorityChip";
import { confidenceLabelFr } from "@/lib/format";
import type { Opportunity } from "@/types";

interface OpportunityCardCompactProps {
  opportunity: Opportunity;
  onChoose: (id: string) => void;
}

export const OpportunityCardCompact = ({
  opportunity,
  onChoose,
}: OpportunityCardCompactProps) => {
  const {
    id,
    title,
    theme = "—",
    score = 0,
    priority = "moyenne",
    content_brief = "",
    metrics,
  } = opportunity;
  const coverage = metrics?.coverage_potential ?? null;
  const confidence = confidenceLabelFr(metrics?.confidence ?? undefined);

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {/* Header: title + score + actions */}
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/40 px-4 py-3">
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 line-clamp-2">
          {title}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
            aria-label={`Score ${score}`}
          >
            {score}
          </span>
        </div>
      </header>

      {/* Body: theme, context */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
            {theme}
          </span>
          <PriorityChip priority={priority} className="text-[11px]" />
        </div>
        <p className="mt-3 min-h-0 flex-1 line-clamp-2 text-[13px] leading-relaxed text-slate-500">
          {content_brief || "—"}
        </p>
        <div className="mt-3 flex shrink-0 items-center gap-3 text-xs text-slate-600">
          <span>
            <span className="font-medium text-slate-500">Couverture :</span>{" "}
            {coverage != null ? coverage : "—"}
          </span>
          <span>
            <span className="font-medium text-slate-500">Confiance :</span> {confidence}
          </span>
        </div>
      </div>

      {/* Footer: CTA principal */}
      <footer className="flex shrink-0 border-t border-slate-100 bg-white px-4 py-2.5">
        <Button
          size="sm"
          className="h-8 w-full text-xs font-medium"
          onClick={() => onChoose(id)}
        >
          Choisir ce sujet
        </Button>
      </footer>
    </article>
  );
};

"use client";

import { Button } from "@/components/ui/button";
import { confidenceLabelFr } from "@/lib/format";
import type { Opportunity } from "@/types";

interface OpportunityTableRowProps {
  opportunity: Opportunity;
  onChoose: (id: string) => void;
}

export const OpportunityTableRow = ({
  opportunity,
  onChoose,
}: OpportunityTableRowProps) => {
  const {
    id,
    title,
    theme = "—",
    score = 0,
    content_brief = "",
    metrics,
  } = opportunity;
  const coverage = metrics?.coverage_potential ?? null;
  const confidence = confidenceLabelFr(metrics?.confidence ?? undefined);

  return (
    <tr
      className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
      data-opportunity-id={id}
    >
      <td className="w-[30%] min-w-0 py-2.5 pl-4 pr-2 align-top">
        <div className="font-medium text-slate-900 line-clamp-2">{title}</div>
      </td>
      <td className="w-[8%] min-w-0 py-2.5 pr-2 align-top">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
          {theme}
        </span>
      </td>
      <td className="w-[20%] min-w-0 py-2.5 pr-2 align-top">
        <div className="text-xs text-slate-600 line-clamp-2">{content_brief || "—"}</div>
      </td>
      <td className="w-[6%] py-2.5 pr-2 align-middle text-right tabular-nums">
        <span className="font-semibold text-slate-800">{score}</span>
      </td>
      <td className="w-[6%] py-2.5 pr-2 align-middle text-right tabular-nums text-xs text-slate-600">
        {coverage != null ? coverage : "—"}
      </td>
      <td className="w-[8%] py-2.5 pr-2 align-middle text-xs text-slate-600">
        {confidence}
      </td>
      <td className="w-[22%] py-2.5 pl-2 pr-4 align-middle">
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => onChoose(id)}
          >
            Choisir
          </Button>
        </div>
      </td>
    </tr>
  );
};

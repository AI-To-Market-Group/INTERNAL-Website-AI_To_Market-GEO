"use client";

import type { PriorityLevel } from "@/types";

const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  haute: "High",
  moyenne: "Medium",
  basse: "Low",
};

const PRIORITY_CLASS: Record<PriorityLevel, string> = {
  haute: "bg-emerald-50 text-emerald-800 border-emerald-200",
  moyenne: "bg-amber-50 text-amber-800 border-amber-200",
  basse: "bg-slate-100 text-slate-600 border-slate-200",
};

const TOOLTIP_TEXT =
  "High = high score or urgent opportunity (near date / strong trend / active competition).";

interface PriorityChipProps {
  priority: PriorityLevel;
  className?: string;
}

export const PriorityChip = ({ priority, className }: PriorityChipProps) => {
  return (
    <span
      title={TOOLTIP_TEXT}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASS[priority]} ${className ?? ""}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
};

"use client";

import { useRef, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { PriorityChip } from "@/components/radar/PriorityChip";
import { SourceBadges } from "@/components/radar/SourceBadges";
import type { Opportunity } from "@/types";

interface OpportunityContextPopoverProps {
  opportunity: Opportunity | null;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function OpportunityContextPopover({
  opportunity,
  trigger,
  open,
  onOpenChange,
  className,
}: OpportunityContextPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, onOpenChange]);

  if (!opportunity) return <>{trigger}</>;

  const {
    title,
    theme = "—",
    intents = [],
    sources = [],
    score = 0,
    priority = "moyenne",
    content_brief = "",
  } = opportunity;

  return (
    <div className={className} ref={ref}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100"
      >
        {trigger}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <p className="font-semibold text-slate-900">{title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{theme}</Badge>
            {intents.map((i) => (
              <Badge key={i} variant="outline" className="bg-slate-50">
                {i}
              </Badge>
            ))}
            <SourceBadges sources={sources} />
            <span className="text-sm font-bold text-slate-900">{score}</span>
            <PriorityChip priority={priority} />
          </div>
          {content_brief && (
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-medium text-slate-500">Pourquoi maintenant :</span> {content_brief}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

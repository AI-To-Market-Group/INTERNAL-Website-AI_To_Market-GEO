"use client";

import { Calendar, Search, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OpportunitySource } from "@/types";

const SOURCE_CONFIG: Record<
  OpportunitySource,
  { icon: typeof Calendar; label: string; className: string }
> = {
  date: {
    icon: Calendar,
    label: "Seasonal",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  trend: {
    icon: TrendingUp,
    label: "Trend",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  gap: {
    icon: Search,
    label: "Concurrence",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
};

interface SourceBadgesProps {
  sources: OpportunitySource[];
  className?: string;
}

export const SourceBadges = ({ sources, className }: SourceBadgesProps) => {
  if (!sources?.length) return null;
  return (
    <div className={className}>
      {sources.map((source) => {
        const config = SOURCE_CONFIG[source];
        if (!config) return null;
        const Icon = config.icon;
        return (
          <Badge
            key={source}
            variant="outline"
            className={`text-xs font-medium ${config.className}`}
          >
            <Icon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        );
      })}
    </div>
  );
};

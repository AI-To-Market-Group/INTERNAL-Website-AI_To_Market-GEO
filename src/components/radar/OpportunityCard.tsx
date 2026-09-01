"use client";

import { Calendar, Loader2, FileText, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { confidenceLabelFr } from "@/lib/format";
import type { Opportunity, OpportunityType, ConfidenceLevel } from "@/types";

interface OpportunityCardProps {
  data: Opportunity;
  onGenerate: (id: string) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  hasSession?: boolean;
  /** When true, shows "Sent to WordPress" badge */
  sentToWordPress?: boolean;
}

const getTypeLabel = (type: OpportunityType | undefined) => {
  if (type === "SEASONAL") return "Seasonal";
  if (type === "TREND") return "Trends";
  return "Competitors";
};

/**
 * Theme badge colors (4 API themes)
 */
const getThemeBadgeConfig = (theme: string) => {
  const configs: Record<string, string> = {
    "Store Operational Excellence": "bg-primary/15 text-foreground border-transparent",
    "Data-Driven Commerce": "bg-primary/15 text-foreground border-transparent",
    "Retail Media & Shopper Experience": "bg-primary/15 text-foreground border-transparent",
    "AI & Computer Vision": "bg-primary/15 text-foreground border-transparent",
  };
  return configs[theme] ?? "bg-slate-100 text-slate-700 border-slate-200";
};

/**
 * Title color based on type (seasonal = purple, others = dark)
 */
const getTitleColor = (type: OpportunityType | undefined) => {
  if (type === "SEASONAL") return "text-[#5C40B3]";
  return "text-slate-900";
};

/**
 * Extract the main topic from the title by removing prefixes
 */
const extractTopic = (title: string): string => {
  // Return the full title - no truncation
  return title;
};

/**
 * Confidence badge color — palettes distinctes pour chaque niveau
 */
const getConfidenceColor = (confidence: ConfidenceLevel | null | undefined): string => {
  if (confidence === "strong") return "text-emerald-700";
  if (confidence === "good") return "text-[#0F766E]";   // dark teal (distinct from green)
  if (confidence === "medium") return "text-amber-600";
  if (confidence === "low") return "text-slate-500";
  return "text-slate-600";
};

/**
 * Format intents for display (capitalize first letter)
 */
const formatIntent = (intent: string): string => {
  return intent.charAt(0).toUpperCase() + intent.slice(1).replace(/_/g, " ");
};

export const OpportunityCard = ({
  data,
  onGenerate,
  onDelete,
  isLoading = false,
  hasSession = false,
  sentToWordPress = false,
}: OpportunityCardProps) => {
  const typeLabel = getTypeLabel(data.type);
  
  // Use score or impact_score
  const score = data.score ?? data.impact_score ?? 0;
  const confidence = data.metrics?.confidence ?? null;
  const intents = data.intents ?? [];
  const eventName =
    data.active_season ?? data.metrics?.event_name ?? null;
  const daysUntilEvent = data.metrics?.days_until_event ?? null;
  const isDateOpportunity =
    data.type === "SEASONAL" || (data.sources ?? []).includes("date");
  const theme = data.theme ?? "—";

  return (
    <Card className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md h-full gap-4 py-4">
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(data.id); }}
          className="absolute right-2 top-2 z-10 rounded-full p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
          title="Delete opportunity"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <CardHeader className="px-5 pt-4 pb-3 flex-shrink-0 space-y-2">
        <div className="flex items-start gap-2 w-full">
          <h3 className={cn("text-base font-semibold leading-tight flex-1 min-w-0", getTitleColor(data.type))}>
            {extractTopic(data.title)}
          </h3>
          <div className="flex shrink-0 items-center gap-1 mt-0.5">
            {sentToWordPress && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800" title="Published to Sanity">
                <Check className="h-3 w-3" />
                Sanity
              </span>
            )}
            {hasSession && !sentToWordPress && (
              <span title="Session in progress">
                <FileText className="h-3.5 w-3.5 text-blue-500" />
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={cn("rounded-md text-xs font-medium shrink-0", getThemeBadgeConfig(theme))}>
            {theme}
          </Badge>
          <div className="flex flex-col items-end text-right shrink-0">
            <span className="text-xl font-bold leading-none text-slate-900">{score}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Score</span>
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 min-h-0 flex flex-col justify-center gap-1.5 px-5 py-2">
        {isDateOpportunity && (eventName || daysUntilEvent != null) && (
          <div className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
            <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              {eventName && <strong className="text-foreground">{eventName}</strong>}
              {eventName && daysUntilEvent != null && " "}
              {daysUntilEvent != null && (
                <span className="text-slate-500">J-{daysUntilEvent}</span>
              )}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[13px] font-medium text-slate-500">Intent:</span>
          {intents.length > 0 ? (
            intents.slice(0, 3).map((intent) => (
              <span
                key={intent}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
              >
                {formatIntent(intent)}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      </div>

      <CardFooter className="flex flex-col gap-3 px-5 pb-4 pt-0 flex-shrink-0 mt-auto">
        <div className="grid w-full grid-cols-2 gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Confidence</span>
            <span className={cn("text-sm font-semibold leading-none", getConfidenceColor(confidence))}>
              {confidenceLabelFr(confidence)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Type</span>
            <span className="text-sm font-semibold leading-none text-slate-700">{typeLabel}</span>
          </div>
        </div>

        <Button 
          className="w-full h-10 font-medium shadow-sm transition-all duration-200" 
          onClick={() => onGenerate(data.id)} 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : sentToWordPress ? (
            "View article"
          ) : hasSession ? (
            "Resume"
          ) : (
            "Create article"
          )}
        </Button>
      </CardFooter>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
          <div className="text-center">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-600" />
            <div className="text-sm text-slate-600">Processing...</div>
          </div>
        </div>
      )}
    </Card>
  );
};

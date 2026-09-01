"use client";

import { FileText, Clock, AlignLeft, X, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BuilderSessionInfo } from "@/types";

interface DraftCardProps {
  session: BuilderSessionInfo;
  onOpen: (opportunityId: string) => void;
  onDelete?: (opportunityId: string) => void;
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function stepLabel(step: number | undefined) {
  if (step === 3) return { label: "Published", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (step === 2) return { label: "Writing",   color: "text-blue-700   bg-blue-50   border-blue-200"    };
  return           { label: "Outline",          color: "text-slate-600  bg-slate-50  border-slate-200"   };
}

export function DraftCard({ session, onOpen, onDelete }: DraftCardProps) {
  const title   = session.draft?.title || session.topicTitle;
  const theme   = session.opportunityContext?.theme;
  const blocks  = session.draft?.blocks ?? [];
  const headings = blocks.filter((b) => b.type === "heading").length;
  const words   = blocks
    .map((b) => (b.content ?? "").replace(/<[^>]+>/g, "").trim().split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
  const step    = stepLabel(session.currentStep);

  return (
    <Card className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md h-full gap-0 py-0">
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(session.opportunityId); }}
          className="absolute right-2 top-2 z-10 rounded-full p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
          title="Delete draft"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 flex-shrink-0 space-y-2.5">
        <div className="flex items-start gap-2 pr-6">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <h3 className="text-sm font-semibold leading-snug text-slate-900 line-clamp-3">{title}</h3>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {theme ? (
            <Badge variant="outline" className="rounded-md text-xs font-medium bg-primary/10 border-transparent text-foreground shrink-0">
              {theme}
            </Badge>
          ) : (
            <span />
          )}
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", step.color)}>
            {step.label}
          </span>
        </div>
      </CardHeader>

      {/* Stats */}
      <div className="flex-1 flex flex-col justify-center gap-2 px-5 py-3 border-t border-slate-50">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <AlignLeft className="h-3.5 w-3.5" />
            {headings} sections · ~{words} words
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          <span>Last saved {formatRelativeDate(session.updatedAt)}</span>
        </div>
      </div>

      {/* Footer */}
      <CardFooter className="px-5 pb-5 pt-3 flex-shrink-0 border-t border-slate-100">
        <Button
          className="w-full h-9 font-medium gap-1.5"
          onClick={() => onOpen(session.opportunityId)}
        >
          Continue writing
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}

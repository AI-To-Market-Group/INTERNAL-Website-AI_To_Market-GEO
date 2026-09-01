"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourceBadges } from "./SourceBadges";
import { PriorityChip } from "./PriorityChip";
import type { Opportunity } from "@/types";

interface DetailsDrawerProps {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (id: string) => void;
}

export const DetailsDrawer = ({
  opportunity,
  open,
  onOpenChange,
  onChoose,
}: DetailsDrawerProps) => {
  if (!opportunity) return null;

  const {
    id,
    title,
    theme = "—",
    intents = [],
    sources = [],
    score = 0,
    priority = "moyenne",
    content_brief = "",
    justification_signals,
    metrics,
    competitor_articles,
  } = opportunity;

  const confidence = metrics?.confidence;
  const topicQuality = metrics?.topic_quality ?? metrics?.search_volume;
  const coveragePotential = metrics?.coverage_potential ?? metrics?.keyword_difficulty;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="outline">{theme}</Badge>
            {intents.map((i) => (
              <Badge key={i} variant="outline" className="bg-slate-50">
                {i}
              </Badge>
            ))}
            <SourceBadges sources={sources} />
            <span className="text-lg font-bold text-slate-900">{score}</span>
            <PriorityChip priority={priority} />
          </div>
          <Button
            className="mt-4 w-full"
            onClick={() => {
              onChoose(id);
              onOpenChange(false);
            }}
          >
            Choisir ce sujet
          </Button>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Summary
            </h3>
            <p className="text-slate-700">{content_brief}</p>
          </section>

          {justification_signals && justification_signals.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Justification
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                {justification_signals.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              SEO metrics
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {topicQuality != null && (
                <div>
                  <span className="text-slate-500">Topic quality</span>
                  <p className="font-medium text-slate-900">{topicQuality}</p>
                </div>
              )}
              {coveragePotential != null && (
                <div>
                  <span className="text-slate-500">Potentiel couverture</span>
                  <p className="font-medium text-slate-900">{coveragePotential}</p>
                </div>
              )}
              {confidence && (
                <div>
                  <span className="text-slate-500">Confiance</span>
                  <p className="font-medium capitalize text-slate-900">
                    {confidence}
                  </p>
                </div>
              )}
            </div>
          </section>

          {competitor_articles && competitor_articles.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Concurrence
              </h3>
              <ul className="space-y-2">
                {competitor_articles.slice(0, 5).map((art, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={art.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {art.title}
                    </a>
                    <span className="ml-1 text-slate-500">({art.source})</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

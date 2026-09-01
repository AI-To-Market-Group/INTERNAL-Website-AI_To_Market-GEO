"use client";

import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { AutosaveIndicator, type AutosaveStatus } from "./AutosaveIndicator";
import { BuilderStepper, type BuilderStep } from "./BuilderStepper";
import { IllustrationSlot } from "./IllustrationSlot";
import type { Opportunity, OutlineSection } from "@/types";

interface ArticleBuilderShellProps {
  opportunity: Opportunity | null;
  /** Approved outline — used as richer context for illustration generation */
  outline?: OutlineSection[];
  currentStep: BuilderStep;
  onStepChange: (step: BuilderStep) => void;
  autosaveStatus: AutosaveStatus;
  /** Title to display (draft.title when editing, else opportunity.title) */
  displayTitle?: string;
  /** When set, title is editable (step 2) */
  onTitleChange?: (title: string) => void;
  /** Step 2 (Article) is only clickable when content is generated */
  canNavigateToStep?: (step: BuilderStep) => boolean;
  /** When set, step 3 shows checkmark (draft sent to WordPress) */
  sentToWordPressAt?: string | null;
  /** Called when user clicks "Retour au Radar" (saves then navigates) */
  onBackToRadar?: () => void;
  /** Opportunity ID used to persist illustration URL across navigations */
  opportunityId?: string;
  children: React.ReactNode;
}

export function ArticleBuilderShell({
  opportunity,
  currentStep,
  onStepChange,
  autosaveStatus,
  displayTitle,
  onTitleChange,
  canNavigateToStep,
  sentToWordPressAt,
  onBackToRadar,
  opportunityId,
  outline,
  children,
}: ArticleBuilderShellProps) {
  const title = displayTitle ?? opportunity?.title ?? "—";

  // Build illustration summary: prefer H2 outline headings, then title + tags, never the raw content_brief
  const illustrationSummary = (() => {
    if (outline && outline.length > 0) {
      const h2s = outline.filter((s) => s.headingLevel === "H2").map((s) => s.title);
      if (h2s.length > 0) return h2s.join("; ");
    }
    const tags = (opportunity as { tags?: string[] } | undefined)?.tags ?? [];
    const tagStr = tags.length > 0 ? ` covering: ${tags.join(", ")}` : "";
    return `${opportunity?.title ?? ""}${tagStr}`;
  })();
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="border-b border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={onBackToRadar}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to radar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStepChange(1)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to outline
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <AutosaveIndicator
              status={autosaveStatus}
              className="text-xs text-slate-500"
            />
            <BuilderStepper
              currentStep={currentStep}
              onStepClick={onStepChange}
              isStepEnabled={canNavigateToStep}
              sentToWordPressAt={sentToWordPressAt}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {onTitleChange ? (
          <input
            id="draft-h1"
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Article title"
            className="mb-6 w-full border-none bg-transparent text-xl font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0"
          />
        ) : (
          <h1 id="draft-h1" className="mb-6 text-xl font-semibold text-slate-900">
            {title}
          </h1>
        )}
        {currentStep === 2 && (
          <IllustrationSlot title={title} summary={illustrationSummary} surface="dark" opportunityId={opportunityId} />
        )}
        {children}
      </main>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { BookmarkPlus, Sparkles } from "lucide-react";

interface StickyDraftActionBarProps {
  onBackToPlan: () => void;
  onSaveAsDraft?: () => void;
  isSavingDraft?: boolean;
  onRefineDraft?: () => void;
  isRefining?: boolean;
  isSaving?: boolean;
}

export function StickyDraftActionBar({
  onBackToPlan,
  onSaveAsDraft,
  isSavingDraft = false,
  onRefineDraft,
  isRefining = false,
  isSaving = false,
}: StickyDraftActionBarProps) {
  const busy = isSaving || isSavingDraft || isRefining;
  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onBackToPlan} disabled={busy}>
          Back to outline
        </Button>
      </div>
      <div className="flex gap-2">
        {onRefineDraft && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefineDraft}
            disabled={busy}
            className="gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50"
          >
            {isRefining ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                Refining…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Refine to Industry Level
              </>
            )}
          </Button>
        )}
        {onSaveAsDraft && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveAsDraft}
            disabled={busy}
            className="gap-1.5"
          >
            {isSavingDraft ? (
              <>Saving…</>
            ) : (
              <>
                <BookmarkPlus className="h-4 w-4" />
                Save as Draft
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

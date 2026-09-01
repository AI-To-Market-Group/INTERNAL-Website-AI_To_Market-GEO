"use client";

import { Button } from "@/components/ui/button";

interface StickyActionBarProps {
  onValidatePlan: () => void;
  onBackToRadar?: () => void;
  isSaving?: boolean;
  canValidate?: boolean;
}

export function StickyActionBar({
  onValidatePlan,
  onBackToRadar,
  isSaving = false,
  canValidate = true,
}: StickyActionBarProps) {
  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onBackToRadar}>
          Back to Radar
        </Button>
      </div>
      <Button
        size="sm"
        onClick={onValidatePlan}
        disabled={isSaving || !canValidate}
      >
        Validate outline
      </Button>
    </div>
  );
}

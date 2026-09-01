"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuilderStep = 1 | 2;

const STEPS: { step: BuilderStep; label: string }[] = [
  { step: 1, label: "Plan" },
  { step: 2, label: "Article" },
];

interface BuilderStepperProps {
  currentStep: BuilderStep;
  onStepClick: (step: BuilderStep) => void;
  /** Return false to disable clicking on a step */
  isStepEnabled?: (step: BuilderStep) => boolean;
  /** When set, step 2 shows a checkmark (draft sent to Sanity) */
  sentToWordPressAt?: string | null;
  className?: string;
}

export function BuilderStepper({ currentStep, onStepClick, isStepEnabled, sentToWordPressAt, className }: BuilderStepperProps) {
  return (
    <nav aria-label="Builder steps" className={cn("flex items-center gap-2", className)}>
      {STEPS.map(({ step, label }) => {
        const isActive = currentStep === step;
        const isPast = currentStep > step;
        const isEnabled = isStepEnabled?.(step) ?? true;
        const isSent = step === 2 && sentToWordPressAt;
        return (
          <button
            key={step}
            type="button"
            onClick={() => isEnabled && onStepClick(step)}
            disabled={!isEnabled}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive && "bg-primary/15 text-foreground",
              isPast && !isActive && isEnabled && "text-slate-600 hover:text-slate-900",
              !isActive && !isPast && "text-slate-500 hover:text-slate-700",
              !isEnabled && "cursor-not-allowed opacity-60 hover:opacity-60"
            )}
          >
            {step} {label}
            {isSent && <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />}
          </button>
        );
      })}
    </nav>
  );
}

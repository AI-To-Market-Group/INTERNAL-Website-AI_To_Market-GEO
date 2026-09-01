"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrganicLoader } from "@/components/ui/organic-loader";

interface RegenerateSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instruction: string;
  onInstructionChange: (value: string) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  /** Override for paragraph regeneration (e.g. "Regenerate this paragraph"). */
  title?: string;
  placeholder?: string;
}

const DEFAULT_TITLE = "Regenerate this section";
const DEFAULT_PLACEHOLDER = "e.g. More practical, add examples";

const REASON_PRESETS = [
  "Too generic",
  "Wrong angle",
  "Wrong tone",
  "Missing key points",
  "Too short",
  "Factually incorrect",
];

export function RegenerateSectionModal({
  open,
  onOpenChange,
  instruction,
  onInstructionChange,
  onConfirm,
  isLoading = false,
  title = DEFAULT_TITLE,
  placeholder = DEFAULT_PLACEHOLDER,
}: RegenerateSectionModalProps) {
  function applyPreset(preset: string) {
    const current = instruction.trim();
    onInstructionChange(current ? `${current}, ${preset.toLowerCase()}` : preset);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                disabled={isLoading}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600 hover:border-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <label
              htmlFor="regen-instruction"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Instruction (optional)
            </label>
            <Input
              id="regen-instruction"
              value={instruction}
              onChange={(e) => onInstructionChange(e.target.value)}
              placeholder={placeholder}
              className="w-full"
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <OrganicLoader variant="taffy" size={16} aria-label="Regenerating" className="text-primary-foreground" />
                Regenerating…
              </span>
            ) : (
              "Regenerate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

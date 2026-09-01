"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TitleSuggestionsModalProps {
  userInput: string;
  titles: string[];
  onSelectTitle: (title: string) => void;
  onRefresh: () => void;
  onClose: () => void;
  isRefreshing?: boolean;
}

export const TitleSuggestionsModal = ({
  userInput,
  titles,
  onSelectTitle,
  onRefresh,
  onClose,
  isRefreshing = false,
}: TitleSuggestionsModalProps) => {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Choose a title
          </DialogTitle>
          <DialogDescription>
            From your input: &quot;{userInput.slice(0, 60)}
            {userInput.length > 60 ? "…" : ""}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {titles.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No titles generated.
            </p>
          ) : (
            titles.map((title) => (
              <Button
                key={title}
                variant="outline"
                className="h-auto w-full justify-start px-4 py-3 text-left hover:bg-slate-50"
                onClick={() => {
                  onSelectTitle(title);
                  onClose();
                }}
              >
                <span className="text-sm font-medium text-slate-900">
                  {title}
                </span>
              </Button>
            ))
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-slate-600"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Regenerate titles
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

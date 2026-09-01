"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GenerateEyeContentFromKeywordsResponse } from "@/types";

interface KeywordsTopicsModalProps {
  keywords: string[];
  result: GenerateEyeContentFromKeywordsResponse;
  onSelectTopic: (topic: string) => void;
  onClose: () => void;
}

export const KeywordsTopicsModal = ({
  keywords,
  result,
  onSelectTopic,
  onClose,
}: KeywordsTopicsModalProps) => {
  const topics = result.generated_topics.topics ?? [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Topics generated from: {keywords.join(", ")}
          </DialogTitle>
          <DialogDescription>
            Select a topic to create the article
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {topics.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No topics generated.
            </p>
          ) : (
            topics.map((topic) => (
              <Button
                key={topic.id}
                variant="outline"
                className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-slate-50"
                onClick={() => {
                  onSelectTopic(topic.title);
                  onClose();
                }}
              >
                <span className="text-sm font-medium text-slate-900">
                  {topic.title}
                </span>
              </Button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

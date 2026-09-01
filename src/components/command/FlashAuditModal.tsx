"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber } from "@/lib/format";
import type { FlashAuditResponse } from "@/types";

interface FlashAuditModalProps {
  topic: string;
  result: FlashAuditResponse;
  onGenerate: () => void;
  onClose: () => void;
}

const getRecommendationClass = (recommendation: FlashAuditResponse["recommendation"]) => {
  if (recommendation === "high") return "bg-[#CBFFA8] text-slate-900 border-transparent"; // Accent Green
  if (recommendation === "medium") return "bg-[#FFF27F] text-slate-900 border-transparent"; // Yellow
  return "bg-slate-100 text-slate-700 border-transparent";
};

const getRecommendationLabel = (recommendation: FlashAuditResponse["recommendation"]) => {
  if (recommendation === "high") return "High";
  if (recommendation === "medium") return "Medium";
  return "Low";
};

export const FlashAuditModal = ({
  topic,
  result,
  onGenerate,
  onClose,
}: FlashAuditModalProps) => {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-foreground">Flash Audit: {topic}</DialogTitle>
          <DialogDescription>Quick SEO analysis of the proposed topic</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Search volume</p>
            <p className="text-2xl font-bold">{formatNumber(result.search_volume)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Difficulty</p>
            <p className="text-2xl font-bold">{result.keyword_difficulty}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Impact score</p>
            <p className="text-2xl font-bold">{result.impact_score}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Recommendation</p>
            <Badge variant="outline" className={getRecommendationClass(result.recommendation)}>
              {getRecommendationLabel(result.recommendation)}
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onGenerate}>Generate article</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

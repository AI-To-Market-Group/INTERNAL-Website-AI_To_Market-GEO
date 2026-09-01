"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFromKeywords } from "@/hooks/useFromKeywords";
import type { GenerateEyeContentFromKeywordsResponse } from "@/types";

export function KeywordDirectionBlock() {
  const [keywords, setKeywords] = useState("");
  const [result, setResult] = useState<GenerateEyeContentFromKeywordsResponse | null>(null);
  const fromKeywords = useFromKeywords();

  const handleAnalyze = async () => {
    const input = keywords.trim();
    if (!input) return;
    setResult(null);
    const keywordList = input.split(/[,;]/).map((k) => k.trim()).filter(Boolean);
    if (keywordList.length === 0) return;
    try {
      const data = await fromKeywords.mutateAsync({
        keywords: keywordList,
        language: "en",
      });
      setResult(data);
    } catch {
      setResult(null);
    }
  };

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Keywords to guide an article…"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            className="h-9 pl-9 pr-3 text-sm"
          />
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={!keywords.trim() || fromKeywords.isPending}
          size="sm"
          className="h-9 px-4 disabled:opacity-50"
        >
          {fromKeywords.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Analyze"
          )}
        </Button>
      </div>
      {result?.generated_topics?.topics && result.generated_topics.topics.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          3 suggested titles: {result.generated_topics.topics.map((t) => t.title).join(" · ")}
        </p>
      )}
    </section>
  );
}

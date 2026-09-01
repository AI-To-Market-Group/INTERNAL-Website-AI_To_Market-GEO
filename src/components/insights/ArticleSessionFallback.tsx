"use client";

import { useEffect, useState } from "react";
import InsightArticleClient from "./InsightArticleClient";
import LinkedInPostClient from "./LinkedInPostClient";
import type { InsightDoc } from "@/lib/insights/shared";

export default function ArticleSessionFallback({ slug }: { slug: string }) {
  const [article, setArticle] = useState<InsightDoc | null | undefined>(undefined);

  useEffect(() => {
    try {
      // Try localStorage first (persists across navigations), then sessionStorage as fallback
      const raw =
        localStorage.getItem(`article-preview:${slug}`) ??
        sessionStorage.getItem(`article-preview:${slug}`);
      if (raw) {
        setArticle(JSON.parse(raw) as InsightDoc);
      } else {
        setArticle(null);
      }
    } catch {
      setArticle(null);
    }
  }, [slug]);

  if (article === undefined) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading…</div>;
  }

  if (article === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-semibold">Article not found</h1>
        <p className="text-muted-foreground">Slug: {slug}</p>
      </div>
    );
  }

  if (article.category === "linkedin") {
    return <LinkedInPostClient article={article} parent={null} />;
  }

  return <InsightArticleClient article={article} parent={null} />;
}

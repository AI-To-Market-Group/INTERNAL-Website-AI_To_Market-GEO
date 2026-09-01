import { getInsightBySlug } from "@/lib/insights/content";
import InsightArticleClient from "@/components/insights/InsightArticleClient";
import LinkedInPostClient from "@/components/insights/LinkedInPostClient";
import ArticleSessionFallback from "@/components/insights/ArticleSessionFallback";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { InsightFrontmatter } from "@/lib/insights/shared";

export const dynamic = "force-dynamic";

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { slug } = await params;
  const article = await getInsightBySlug(user.id, slug);

  if (!article) {
    return <ArticleSessionFallback slug={slug} />;
  }

  // Fetch parent (one level only)
  let parent: InsightFrontmatter | null = null;
  if (article.parentSlug) {
    const p = await getInsightBySlug(user.id, article.parentSlug);
    if (p) {
      const { markdown: _discard, ...frontmatter } = p;
      parent = frontmatter;
    }
  }

  if (article.category === "linkedin") {
    return <LinkedInPostClient article={article} parent={parent} />;
  }

  return <InsightArticleClient article={article} parent={parent} />;
}

import type { NextRequest } from "next/server";
import { getSession, updateSession } from "@/lib/builder-sessions-store";
import { requireUser } from "@/lib/api-auth";
import type { ArticleDraftBlock, GenerateArticleResponse, InferArticleMetadataResponse, SeoWarning } from "@/types";

type Params = { params: Promise<{ opportunityId: string }> };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "article";
}

function deterministicFields(title: string): Pick<
  InferArticleMetadataResponse,
  "title" | "slug" | "focus_keyword" | "seo_title" | "category"
> {
  const focusKeyword = title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");

  const kwLower = focusKeyword.toLowerCase();
  const kwSlug = slugify(focusKeyword);
  const titleSlug = slugify(title);
  const slug = titleSlug.includes(kwSlug) ? titleSlug : `${kwSlug}-${titleSlug}`.slice(0, 80);

  const rawSeoTitle = title.slice(0, 60);
  const seoTitle = rawSeoTitle.toLowerCase().includes(kwLower)
    ? rawSeoTitle
    : `${focusKeyword}: ${rawSeoTitle}`.slice(0, 60);

  return { title, slug, focus_keyword: focusKeyword, seo_title: seoTitle, category: "News" };
}

function blocksToText(blocks: ArticleDraftBlock[]): string {
  return blocks
    .map((b) => b.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

async function generateContentFields(
  apiKey: string,
  title: string,
  articleText: string
): Promise<{ tags: string[]; excerpt: string; seo_description: string }> {
  // Send title + first ~800 words — enough context, minimal tokens
  const wordLimit = 800;
  const words = articleText.split(/\s+/);
  const snippet = words.slice(0, wordLimit).join(" ") + (words.length > wordLimit ? "…" : "");

  const system = `You are an SEO metadata writer for AI To Market, a B2B AI content and strategy company.

Generate metadata for a blog article. Return JSON only with these three fields:

- "tags": array of 5–7 lowercase topic tags relevant to the article (B2B, AI, marketing, strategy — no generic words like "article" or "blog"). Use hyphenated multi-word tags where appropriate, e.g. "ai-content", "geo-optimisation", "b2b-marketing".
- "excerpt": 1–2 sentence summary of the article (max 200 chars). Write as a value statement, not "This article covers…".
- "seo_description": compelling meta description for search results (max 160 chars). Include a benefit or insight hook. No trailing full stop needed.

Return ONLY valid JSON: { "tags": [...], "excerpt": "...", "seo_description": "..." }`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `TITLE: ${title}\n\nARTICLE:\n${snippet}` },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const parsed = JSON.parse(data.choices[0].message.content) as {
    tags?: unknown;
    excerpt?: unknown;
    seo_description?: unknown;
  };

  const tags = Array.isArray(parsed.tags)
    ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 8)
    : [];
  const excerpt = typeof parsed.excerpt === "string" ? parsed.excerpt.slice(0, 200) : "";
  const seo_description = typeof parsed.seo_description === "string"
    ? parsed.seo_description.slice(0, 160)
    : "";

  return { tags, excerpt, seo_description };
}

function articleResponseToText(article: GenerateArticleResponse): string {
  return article.sections
    .flatMap(s => s.content.paragraphs.map(p => p.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()))
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;

  // v2 fast path: client sends { article: GenerateArticleResponse } directly
  const body = await req.json().catch(() => ({})) as { article?: GenerateArticleResponse };
  if (body.article?.sections?.length) {
    const article = body.article;
    const title = article.title ?? "Article";
    const base = deterministicFields(title);
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    let tags: string[] = [];
    let excerpt = "";
    let seo_description = "";
    const warnings: SeoWarning[] = [];

    if (apiKey) {
      try {
        ({ tags, excerpt, seo_description } = await generateContentFields(apiKey, title, articleResponseToText(article)));
      } catch {
        tags = [title.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/)[0]?.toLowerCase() ?? "ai"];
        excerpt = `Key insights on ${title} for B2B marketing and AI content strategy.`;
        seo_description = `Learn about ${title}. Practical B2B AI content strategy and recommendations.`.slice(0, 160);
        warnings.push({ field: "excerpt", message: "Metadata generated from title only — LLM unavailable." });
      }
    } else {
      tags = [title.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/)[0]?.toLowerCase() ?? "ai"];
      excerpt = `Key insights on ${title} for B2B marketing and AI content strategy.`;
      seo_description = `Learn about ${title}. Practical B2B AI content strategy and recommendations.`.slice(0, 160);
    }

    if (base.seo_title.length > 60)
      warnings.push({ field: "seo_title", message: `SEO title is ${base.seo_title.length} chars (max 60).` });

    const metadata: InferArticleMetadataResponse = { ...base, tags, excerpt, seo_description, seo_warnings: warnings };
    // Also persist to session if it exists (best-effort)
    await updateSession(user.id, opportunityId, { metadataWordPress: metadata }).catch(() => {});
    return Response.json(metadata);
  }

  // v1 / legacy path: read draft from Supabase session
  const session = await getSession(user.id, opportunityId);
  const title = session?.draft?.title ?? session?.topicTitle ?? "Article";
  const blocks = (session?.draft as { blocks?: ArticleDraftBlock[] } | null)?.blocks ?? [];

  // Deterministic fields — no LLM needed
  const base = deterministicFields(title);

  // LLM fields — read article body
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  let tags: string[] = [];
  let excerpt = "";
  let seo_description = "";
  const warnings: SeoWarning[] = [];

  if (apiKey && blocks.length > 0) {
    try {
      const articleText = blocksToText(blocks);
      ({ tags, excerpt, seo_description } = await generateContentFields(apiKey, title, articleText));
    } catch {
      // Fall back to safe defaults if LLM fails — don't block the whole metadata generation
      tags = [title.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/)[0]?.toLowerCase() ?? "ai"];
      excerpt = `Key insights on ${title} for B2B marketing and AI content strategy.`;
      seo_description = `Learn about ${title}. Practical B2B AI content strategy and recommendations.`.slice(0, 160);
      warnings.push({ field: "excerpt", message: "Metadata generated from title only — article text unavailable." });
    }
  } else {
    // No API key or no draft yet
    tags = [title.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/)[0]?.toLowerCase() ?? "ai"];
    excerpt = `Key insights on ${title} for B2B marketing and AI content strategy.`;
    seo_description = `Learn about ${title}. Practical B2B AI content strategy and recommendations.`.slice(0, 160);
  }

  if (base.seo_title.length > 60)
    warnings.push({ field: "seo_title", message: `SEO title is ${base.seo_title.length} chars (max 60).` });

  const metadata: InferArticleMetadataResponse = {
    ...base,
    tags,
    excerpt,
    seo_description,
    seo_warnings: warnings,
  };

  await updateSession(user.id, opportunityId, { metadataWordPress: metadata });
  return Response.json(metadata);
}

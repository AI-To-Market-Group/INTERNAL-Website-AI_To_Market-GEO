import type { NextRequest } from "next/server";
import {
  getInsightBySlug,
  createInsightFile,
  type InsightCategory,
} from "@/lib/insights/content";
import { parseBody, ok, err } from "@/lib/api-response";
import { insightsGenerateSchema } from "@/lib/api-schemas";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { logError } from "@/lib/logger";
import { requireUser } from "@/lib/api-auth";

const MODEL = "gpt-5.4-nano";

async function callOpenAI(messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured.");

  const resp = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${t.slice(0, 300)}`);
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const ip = getClientIp(req);
    const rate = await checkRateLimit(ip, "insights/generate", RATE_LIMITS["insights/generate"]);
    if (!rate.ok) {
      return err("Rate limit exceeded. Try again later.", 429, "RATE_LIMIT_EXCEEDED");
    }

    const parsed = await parseBody(req, insightsGenerateSchema);
    if (parsed.error) return parsed.error;

    const body = parsed.data;
    const { action } = body;

    /* ---------------------------------------------------------------- */
    /*  Create a single article with AI                                 */
    /* ---------------------------------------------------------------- */
    if (action === "create") {
      const category = body.category || "blog";
      const prompt = body.prompt || "Write an article on retail tech.";

      const formatMap: Record<InsightCategory, string> = {
        blog: "a B2B blog article in English, engaging and structured with subheadings, lists and an expert tone. Use Markdown syntax.",
        linkedin:
          "a punchy LinkedIn post in English (~200 words), with measured emojis, bullet points and relevant hashtags at the end.",
        reddit:
          "a Reddit post in English, conversational and authentic tone, suited to discussion format (not too corporate). Use Markdown syntax.",
        wikipedia:
          "encyclopaedic-style content in English, neutral and factual, with clear sections. Use Markdown syntax (##, ###, lists).",
      };

      const systemPrompt = `You are a B2B marketing writer specialised in retail and technology. Write ${formatMap[category]}`;

      const content = await callOpenAI([
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ]);

      const firstLine = content.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").trim() || "New article";
      const title = `New: ${firstLine.slice(0, 100)}`;

      const slug = await createInsightFile(user.id, {
        title,
        category,
        markdown: content,
        excerpt: prompt.slice(0, 200),
      });

      return ok({
        slugs: [slug],
        articles: [{ slug, title, category, markdown: content, excerpt: prompt.slice(0, 200) }],
      });
    }

    /* ---------------------------------------------------------------- */
    /*  Generate blog posts from a press release                        */
    /* ---------------------------------------------------------------- */
    if (action === "generate-blogs") {
      const { sourceSlug, sourceTitle, sourceMarkdown, count = 2 } = body;
      if (!sourceSlug) return err("sourceSlug required", 400);

      let sourceDoc = await getInsightBySlug(user.id, sourceSlug);
      if (!sourceDoc && sourceMarkdown && sourceTitle) {
        sourceDoc = {
          slug: sourceSlug,
          title: sourceTitle,
          category: "blog",
          type: "Article",
          dateISO: new Date().toISOString().slice(0, 10),
          markdown: sourceMarkdown,
        };
      }
      if (!sourceDoc) return err("Source not found", 404, "NOT_FOUND");

      const n = Math.min(Math.max(count, 1), 3);
      const slugs: string[] = [];
      const articles: { slug: string; title: string; category: string; markdown: string; excerpt: string; parentSlug: string }[] = [];

      for (let i = 0; i < n; i++) {
        const angle =
          i === 0
            ? "mainstream summary of key points"
            : i === 1
              ? "practical angle: concrete advice for decision-makers"
              : "forward-looking angle: trends and predictions";

        const content = await callOpenAI([
          {
            role: "system",
            content:
              "You are a B2B writer expert in retail tech. Write a blog article in English (~600 words) from the provided press release. Use Markdown syntax (##, ###, -, >, **bold**). Adopt a professional and engaging tone.",
          },
          {
            role: "user",
            content: `Source press release:\n\nTitle: ${sourceDoc.title}\n\n${sourceDoc.markdown}\n\nDesired angle: ${angle}`,
          },
        ]);

        const firstLine = content
          .split("\n")
          .find((l) => l.trim())
          ?.replace(/^#+\s*/, "")
          .trim() || `Blog article ${i + 1}`;
        const title = `New: ${firstLine.slice(0, 100)}`;
        const excerpt = `Generated from press release: ${sourceDoc.title}`;

        const slug = await createInsightFile(user.id, {
          title,
          category: "blog",
          markdown: content,
          parentSlug: sourceSlug,
          excerpt,
        });
        slugs.push(slug);
        articles.push({ slug, title, category: "blog", markdown: content, excerpt, parentSlug: sourceSlug });
      }

      return ok({ slugs, articles });
    }

    /* ---------------------------------------------------------------- */
    /*  Generate LinkedIn posts from a blog post                        */
    /* ---------------------------------------------------------------- */
    if (action === "generate-linkedin") {
      const { sourceSlug, sourceTitle, sourceMarkdown, count = 2 } = body;
      if (!sourceSlug) return err("sourceSlug required", 400);

      let sourceDoc = await getInsightBySlug(user.id, sourceSlug);
      if (!sourceDoc && sourceMarkdown && sourceTitle) {
        sourceDoc = {
          slug: sourceSlug,
          title: sourceTitle,
          category: "blog",
          type: "Article",
          dateISO: new Date().toISOString().slice(0, 10),
          markdown: sourceMarkdown,
        };
      }
      if (!sourceDoc) return err("Source not found", 404, "NOT_FOUND");

      const n = Math.min(Math.max(count, 1), 3);
      const slugs: string[] = [];
      const articles: { slug: string; title: string; category: string; markdown: string; excerpt: string; parentSlug: string }[] = [];

      for (let i = 0; i < n; i++) {
        const tone =
          i === 0
            ? "professional and factual"
            : i === 1
              ? "inspiring and visionary"
              : "conversational with an open question";

        const content = await callOpenAI([
          {
            role: "system",
            content:
              "You are a LinkedIn expert in retail tech. Write a punchy LinkedIn post in English (~150-250 words). Include bullet points, a catchy hook in the first line, and relevant hashtags at the end. No Markdown title (#), write the post directly.",
          },
          {
            role: "user",
            content: `Source blog article:\n\nTitle: ${sourceDoc.title}\n\n${sourceDoc.markdown}\n\nDesired tone: ${tone}`,
          },
        ]);

        const firstLine = content
          .split("\n")
          .find((l) => l.trim())
          ?.slice(0, 80)
          .trim() || `LinkedIn post ${i + 1}`;
        const title = `New: ${firstLine}`;
        const excerpt = `Generated from blog: ${sourceDoc.title}`;

        const slug = await createInsightFile(user.id, {
          title,
          category: "linkedin",
          markdown: content,
          parentSlug: sourceSlug,
          excerpt,
        });
        slugs.push(slug);
        articles.push({ slug, title, category: "linkedin", markdown: content, excerpt, parentSlug: sourceSlug });
      }

      return ok({ slugs, articles });
    }

    return err("Unknown action", 400);
  } catch (e) {
    logError("/api/insights/generate", e);
    return err(e instanceof Error ? e.message : String(e), 500);
  }
}

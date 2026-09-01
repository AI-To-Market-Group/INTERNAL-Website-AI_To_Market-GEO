import { createInsightFile } from "@/lib/insights/content";
import { parseBody, ok, err } from "@/lib/api-response";
import { draftToMarkdown, defaultWpMetadata } from "@/lib/article-builder-utils";
import { requireUser } from "@/lib/api-auth";
import type { WordPressMetadata } from "@/types";
import { z } from "zod";

const pushFromBuilderSchema = z.object({
  draft: z.object({
    title: z.string().min(1, "draft.title required"),
    blocks: z.array(z.any()).optional(),
  }),
  wpMetadata: z
    .object({
      title: z.string().optional(),
      slug: z.string().optional(),
      excerpt: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      focus_keyword: z.string().optional(),
      seo_title: z.string().optional(),
      seo_description: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const parsed = await parseBody(req, pushFromBuilderSchema);
    if (parsed.error) return parsed.error;

    const { draft, wpMetadata } = parsed.data;

    const meta: WordPressMetadata = wpMetadata
      ? {
          title: wpMetadata.title ?? draft.title,
          slug: wpMetadata.slug ?? draft.title.toLowerCase().replace(/\s+/g, "-"),
          excerpt: wpMetadata.excerpt ?? "",
          category: wpMetadata.category ?? "News",
          tags: wpMetadata.tags ?? [],
          focus_keyword: wpMetadata.focus_keyword,
          seo_title: wpMetadata.seo_title,
          seo_description: wpMetadata.seo_description,
        }
      : defaultWpMetadata(draft.title, draft.title);

    const markdown = draftToMarkdown({
      id: "",
      title: draft.title,
      blocks: draft.blocks ?? [],
      updatedAt: new Date().toISOString(),
    });

    const slug = await createInsightFile(user.id, {
      title: draft.title,
      category: "blog",
      markdown,
      excerpt: meta.excerpt || undefined,
      cmsMetadata: {
        title: meta.title,
        slug: meta.slug,
        excerpt: meta.excerpt,
        category: meta.category,
        tags: meta.tags ?? [],
        focus_keyword: meta.focus_keyword,
        seo_title: meta.seo_title,
        seo_description: meta.seo_description,
      },
    });

    return ok({ slug });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500);
  }
}

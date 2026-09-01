import type { NextRequest } from "next/server";
import { updateInsightCmsMetadata } from "@/lib/insights/content";
import { parseBody, ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { z } from "zod";

const updateMetadataSchema = z.object({
  slug: z.string().min(1, "slug required"),
  cmsMetadata: z.object({
    title: z.string().min(1),
    slug: z.string(),
    excerpt: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    focus_keyword: z.string().optional(),
    seo_title: z.string().optional(),
    seo_description: z.string().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, updateMetadataSchema);
  if (parsed.error) return parsed.error;

  const { slug, cmsMetadata } = parsed.data;

  try {
    const success = await updateInsightCmsMetadata(user.id, slug, cmsMetadata);
    if (!success) {
      return err("Article not found or write error.", 404, "NOT_FOUND");
    }
    return ok({ ok: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500);
  }
}

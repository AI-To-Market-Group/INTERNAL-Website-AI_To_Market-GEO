import type { NextRequest } from "next/server";
import { createInsightFile } from "@/lib/insights/content";
import { parseBody, ok, err } from "@/lib/api-response";
import { insightsCreateSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const parsed = await parseBody(req, insightsCreateSchema);
    if (parsed.error) return parsed.error;

    const { title, category, markdown, parentSlug } = parsed.data;

    const slug = await createInsightFile(user.id, {
      title,
      category: category || "blog",
      markdown: markdown || `Content to be written...\n`,
      parentSlug,
    });

    return ok({ slug });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500);
  }
}

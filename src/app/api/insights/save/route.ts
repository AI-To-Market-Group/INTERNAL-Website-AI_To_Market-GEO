import type { NextRequest } from "next/server";
import { saveInsightMarkdown } from "@/lib/insights/content";
import { parseBody, ok, err } from "@/lib/api-response";
import { insightsSaveSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, insightsSaveSchema);
  if (parsed.error) return parsed.error;

  const { slug, markdown } = parsed.data;

  try {
    const success = await saveInsightMarkdown(user.id, slug, markdown);
    if (!success) {
      return err("Article not found or write error.", 404, "NOT_FOUND");
    }
    return ok({ ok: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500);
  }
}

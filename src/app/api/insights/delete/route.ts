import type { NextRequest } from "next/server";
import { deleteInsightBySlug } from "@/lib/insights/content";
import { parseBody, ok, err } from "@/lib/api-response";
import { insightsDeleteSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, insightsDeleteSchema);
  if (parsed.error) return parsed.error;

  const { slug } = parsed.data;

  try {
    const success = await deleteInsightBySlug(user.id, slug);
    if (!success) {
      return err("Article not found or delete error", 404, "NOT_FOUND");
    }
    return ok({ ok: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500);
  }
}

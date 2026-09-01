import type { NextRequest } from "next/server";
import { updateTitle } from "@/lib/insights/content";
import { parseBody, ok, err } from "@/lib/api-response";
import { insightsUpdateTitleSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, insightsUpdateTitleSchema);
  if (parsed.error) return parsed.error;

  const { slug, title } = parsed.data;

  try {
    const success = await updateTitle(user.id, slug, title);
    if (!success) {
      return err("File not found or write error", 404, "NOT_FOUND");
    }
    return ok({ ok: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500);
  }
}

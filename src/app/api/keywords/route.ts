import type { NextRequest } from "next/server";
import { getKeywords, patchKeywords } from "@/lib/settings-store";
import { ok, parseBody } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { z } from "zod";

const patchKeywordsSchema = z.object({
  seed_keywords: z.array(z.string()).optional(),
});

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const data = await getKeywords(user.id);
  return ok(data);
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, patchKeywordsSchema);
  if (parsed.error) return parsed.error;

  const keywords = parsed.data.seed_keywords ?? [];
  const updated = await patchKeywords(user.id, keywords);
  return ok(updated);
}

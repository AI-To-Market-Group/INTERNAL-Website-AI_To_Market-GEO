import type { NextRequest } from "next/server";
import { updateHeroImage, getInsightBySlug } from "@/lib/insights/content";
import { parseBody, ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  slug: z.string().min(1),
  heroImage: z.union([z.string().url(), z.literal("")]),
});

const BUCKET = "insights-images";

/** Extract storage path from a Supabase public URL, e.g.
 *  https://xxx.supabase.co/storage/v1/object/public/insights-images/uid/file.jpg
 *  → "uid/file.jpg"
 */
function storagePathFromUrl(url: string): string | null {
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const { slug, heroImage } = parsed.data;

  // Fetch current article to get the old hero image URL
  const existing = await getInsightBySlug(user.id, slug);
  const oldUrl = existing?.heroImage ?? "";

  // Delete old image from storage if it's a different Supabase-hosted file
  if (oldUrl && oldUrl !== heroImage) {
    const path = storagePathFromUrl(oldUrl);
    if (path) {
      await supabaseAdmin.storage.from(BUCKET).remove([path]);
    }
  }

  const success = await updateHeroImage(user.id, slug, heroImage);
  if (!success) return err("Article not found", 404);

  return ok({ ok: true });
}

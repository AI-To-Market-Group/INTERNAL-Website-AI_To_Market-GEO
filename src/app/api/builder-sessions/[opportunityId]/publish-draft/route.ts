import type { NextRequest } from "next/server";
import { getSession } from "@/lib/builder-sessions-store";
import { requireUser } from "@/lib/api-auth";
import { publishToSanity } from "@/lib/sanity-publish";
import type { WordPressMetadata } from "@/types";

type Params = { params: Promise<{ opportunityId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;
  const session = await getSession(user.id, opportunityId);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.draft) {
    return Response.json({ error: "No article generated yet. Generate the article first." }, { status: 400 });
  }

  let body: { seoTitle?: string; seoMetaDesc?: string; seoTags?: string[] } = {};
  try { body = (await req.json()) as typeof body; } catch { /* no body is fine */ }

  const title = session.draft.title ?? session.topicTitle;
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);

  const wpMetadata: WordPressMetadata = {
    title: body.seoTitle ?? title,
    slug,
    excerpt: body.seoMetaDesc ?? "",
    category: "news",
    tags: body.seoTags ?? [],
    seo_title: body.seoTitle ?? title,
    seo_description: body.seoMetaDesc ?? "",
  };

  try {
    const { documentId, studioUrl } = await publishToSanity(session, wpMetadata);
    return Response.json({ id: documentId, studioUrl, status: "draft" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

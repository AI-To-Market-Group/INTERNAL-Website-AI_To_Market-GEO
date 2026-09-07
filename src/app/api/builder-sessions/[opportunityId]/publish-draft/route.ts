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

  let body: {
    seoPageTitle?: string;
    seoTitle?: string;
    seoSlug?: string;
    seoMetaDesc?: string;
    seoTags?: string[];
    seoExcerpt?: string;
    seoFocusKeyword?: string;
  } = {};
  try { body = (await req.json()) as typeof body; } catch { /* no body is fine */ }

  const draftTitle = session.draft.title ?? session.topicTitle;
  const title = body.seoPageTitle ?? draftTitle;

  // Use server-generated slug from generate-metadata if available; otherwise derive from title
  const slug = body.seoSlug || title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);

  const wpMetadata: WordPressMetadata = {
    title,
    slug,
    excerpt: body.seoExcerpt ?? "",          // LLM-generated excerpt (≤200 chars)
    category: "News",
    tags: body.seoTags ?? [],
    seo_title: body.seoTitle ?? title.slice(0, 60),
    seo_description: body.seoMetaDesc ?? "",
    focus_keyword: body.seoFocusKeyword,
  };

  try {
    const { documentId, studioUrl } = await publishToSanity(session, wpMetadata);
    return Response.json({ id: documentId, studioUrl, status: "draft" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

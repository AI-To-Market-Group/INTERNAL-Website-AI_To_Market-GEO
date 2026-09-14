import type { NextRequest } from "next/server";
import { getSession } from "@/lib/builder-sessions-store";
import { requireUser } from "@/lib/api-auth";
import { publishToSanity } from "@/lib/sanity-publish";
import type { WordPressMetadata } from "@/types";

type Params = { params: Promise<{ opportunityId: string }> };

/** Upload the hero image to Sanity's asset API and return the asset _id, or null on failure. */
async function uploadHeroToSanity(
  heroImage: string,
  projectId: string,
  dataset: string,
  token: string,
  apiVersion: string
): Promise<string | null> {
  try {
    let body: Buffer;
    let contentType: string;

    if (heroImage.startsWith("data:")) {
      const commaIdx = heroImage.indexOf(",");
      const header = heroImage.slice(0, commaIdx);
      const data = heroImage.slice(commaIdx + 1);
      const mimeMatch = header.match(/data:([^;,]+)/);
      contentType = mimeMatch?.[1] ?? "image/svg+xml";

      if (header.includes(";base64")) {
        body = Buffer.from(data, "base64");
      } else {
        // URL-encoded (e.g. data:image/svg+xml;charset=utf-8,...)
        body = Buffer.from(decodeURIComponent(data), "utf-8");
      }
    } else if (heroImage.startsWith("http")) {
      const res = await fetch(heroImage);
      if (!res.ok) return null;
      contentType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      body = Buffer.from(await res.arrayBuffer());
    } else {
      // Raw SVG string
      contentType = "image/svg+xml";
      body = Buffer.from(heroImage, "utf-8");
    }

    const ext = contentType.includes("svg") ? "svg" : contentType.includes("png") ? "png" : "jpg";
    const uploadRes = await fetch(
      `https://${projectId}.api.sanity.io/v${apiVersion}/assets/images/${dataset}?filename=hero.${ext}`,
      {
        method: "POST",
        headers: { "Content-Type": contentType, Authorization: `Bearer ${token}` },
        // Node's Buffer is a Uint8Array at runtime, but @types/node types it as
        // Buffer<ArrayBufferLike> — and ArrayBufferLike admits SharedArrayBuffer,
        // which fetch's BodyInit does not accept. Re-wrapping gives a
        // Uint8Array backed by a plain ArrayBuffer, which it does.
        body: new Uint8Array(body),
      }
    );

    if (!uploadRes.ok) return null;
    const uploadData = await uploadRes.json() as { document?: { _id?: string } };
    return uploadData.document?._id ?? null;
  } catch {
    return null;
  }
}

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
    seoCategory?: string;
    pullQuote?: string;
    heroImage?: string;
    sectionImages?: (string | null)[];
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

  // Upload images to Sanity assets (non-blocking — failures won't stop publish)
  let thumbnailAssetId: string | null = null;
  let sectionAssetIds: (string | null)[] | undefined;
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET ?? "production";
  const token = process.env.SANITY_API_TOKEN;
  const apiVersion = process.env.SANITY_API_VERSION ?? "2024-01-01";

  if (projectId && token) {
    const uploadTasks: Promise<string | null>[] = [];

    if (body.heroImage) {
      uploadTasks.push(uploadHeroToSanity(body.heroImage, projectId, dataset, token, apiVersion));
    } else {
      uploadTasks.push(Promise.resolve(null));
    }

    const sectionImgs = body.sectionImages ?? [];
    for (const img of sectionImgs) {
      uploadTasks.push(img ? uploadHeroToSanity(img, projectId, dataset, token, apiVersion) : Promise.resolve(null));
    }

    const results = await Promise.all(uploadTasks);
    thumbnailAssetId = results[0];
    if (sectionImgs.length > 0) {
      sectionAssetIds = results.slice(1);
    }
  }

  const wpMetadata: WordPressMetadata = {
    title,
    slug,
    excerpt: body.seoExcerpt ?? "",
    category: body.seoCategory ?? "",
    tags: body.seoTags ?? [],
    seo_title: body.seoTitle ?? title.slice(0, 60),
    seo_description: body.seoMetaDesc ?? "",
    focus_keyword: body.seoFocusKeyword,
  };

  try {
    const { documentId, studioUrl } = await publishToSanity(session, wpMetadata, thumbnailAssetId ?? undefined, sectionAssetIds, body.pullQuote);
    // Mark session as sent in Supabase so the card grid can show it in "Sent to Sanity".
    // Sanity publish already succeeded at this point, so a failure here must stay
    // non-fatal to the response — but it was previously silent even server-side,
    // meaning a card could publish successfully yet never show under "Sent to
    // Sanity" with zero trace of why. Log it, and surface it as a warning field
    // on the response so the client can at least tell the user something's off.
    let sessionStampWarning: string | undefined;
    try {
      const { updateSession } = await import("@/lib/builder-sessions-store");
      const updated = await updateSession(user.id, opportunityId, { sentToWordPressAt: new Date().toISOString() });
      if (!updated) {
        sessionStampWarning = "Published to Sanity, but couldn't mark the session as sent (no matching session row) — it may not show under \"Sent to Sanity\" yet.";
        console.error(`[publish-draft] updateSession returned null for opportunityId=${opportunityId} — sentToWordPressAt not set`);
      }
    } catch (e) {
      sessionStampWarning = "Published to Sanity, but couldn't mark the session as sent — it may not show under \"Sent to Sanity\" yet.";
      console.error(`[publish-draft] updateSession threw for opportunityId=${opportunityId}:`, e);
    }
    return Response.json({ id: documentId, studioUrl, status: "draft", warning: sessionStampWarning });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

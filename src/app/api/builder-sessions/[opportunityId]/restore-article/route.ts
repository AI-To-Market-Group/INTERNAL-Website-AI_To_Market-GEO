import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { getSession } from "@/lib/builder-sessions-store";
import { computeGeoScore } from "@/lib/geo-score";
import type { ArticleDraftBlock, GenerateArticleResponse } from "@/types";

type Params = { params: Promise<{ opportunityId: string }> };

function blocksToV2Article(blocks: ArticleDraftBlock[], title: string): GenerateArticleResponse {
  // Group blocks by sectionOrder from meta, preserving type from meta
  const sectionMap = new Map<number, {
    order: number; type: string; heading: string;
    paragraphs: { id: number; text: string }[];
  }>();

  let currentOrder = 0;

  for (const block of blocks) {
    if (block.type === "heading") {
      currentOrder = (block.meta?.sectionOrder as number | undefined) ?? currentOrder + 1;
      if (!sectionMap.has(currentOrder)) {
        sectionMap.set(currentOrder, {
          order: currentOrder,
          type: (block.meta?.sectionType as string | undefined) ?? "section",
          heading: block.content ?? "",
          paragraphs: [],
        });
      }
    } else if (block.type === "paragraph" && currentOrder > 0) {
      const sec = sectionMap.get(currentOrder);
      if (sec) {
        const paraId = (block.meta?.paragraphId as number | undefined) ?? sec.paragraphs.length + 1;
        sec.paragraphs.push({ id: paraId, text: block.content ?? "" });
      }
    }
  }

  const sections = [...sectionMap.values()]
    .sort((a, b) => a.order - b.order)
    .map(s => ({
      order: s.order,
      type: s.type,
      heading: s.heading,
      content: { paragraphs: s.paragraphs, bullets: [] as string[] },
    }));

  return { title, sections };
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;
  const session = await getSession(user.id, opportunityId);

  if (!session?.draft?.blocks?.length) {
    return err("No saved article found for this session.", 404, "NOT_FOUND");
  }

  const article = blocksToV2Article(session.draft.blocks, session.draft.title ?? session.topicTitle ?? "");

  const plainText = article.sections
    .flatMap(s => s.content.paragraphs.map(p => p.text))
    .join(" ");

  const geoScore = (() => {
    try { return computeGeoScore(plainText, article.title, article); }
    catch { return null; }
  })();

  // Do not re-run quality checks on restore — the article was already reviewed
  // and sent; showing stale content-quality errors on a sent article is misleading.
  return ok({ article, geoScore, qualityFlags: [] });
}

import type { NextRequest } from "next/server";
import { getSession, updateSession } from "@/lib/builder-sessions-store";
import { requireUser } from "@/lib/api-auth";
import { publishToSanity } from "@/lib/sanity-publish";
import { detectViolations, correctViolations } from "@/lib/brand-voice-checker";
import { computeGeoScore } from "@/lib/geo-score";
import type {
  ArticleDraft,
  ArticleDraftBlock,
  GenerateArticleResponse,
  GeoScore,
  BrandVoiceResidual,
  BrandVoiceStatus,
} from "@/types";

type Params = { params: Promise<{ opportunityId: string }> };

function blocksToPlainText(blocks: ArticleDraftBlock[]): string {
  return blocks
    .map((b) => (b.content ?? "").replace(/<[^>]+>/g, " "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function blocksToGenerateArticleResponse(draft: ArticleDraft): GenerateArticleResponse {
  const sections: GenerateArticleResponse["sections"] = [];
  let heading = "";
  let paragraphs: string[] = [];

  const flush = () => {
    if (!heading) return;
    sections.push({
      order: sections.length + 1,
      type: "section",
      heading,
      content: {
        paragraphs: paragraphs.map((t, i) => ({ id: i + 1, text: t })),
        bullets: [],
      },
    });
    heading = "";
    paragraphs = [];
  };

  for (const block of draft.blocks) {
    if (block.type === "heading") {
      flush();
      heading = block.content;
    } else if (block.type === "paragraph" && heading) {
      paragraphs.push(block.content);
    }
  }
  flush();

  return { title: draft.title, sections };
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;
  const session = await getSession(user.id, opportunityId);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const draft = (session?.draft as ArticleDraft | null) ?? null;
  const title = draft?.title ?? session.topicTitle ?? "Article";

  // ── Brand voice — detect + correct; write corrected draft back before publishing ──
  let brandVoiceStatus: BrandVoiceStatus | undefined;
  let publishDraft = draft;

  if (draft?.blocks?.length) {
    try {
      // Pass full HTML block content — correctViolations is instructed to preserve HTML tags.
      const blockTexts = draft.blocks.map((b) => b.content ?? "");
      const bvChecks = detectViolations(blockTexts);

      if (bvChecks.some((c) => c.violations.length > 0)) {
        const corrections = await correctViolations(blockTexts, bvChecks);
        const correctedBlocks = draft.blocks.map((block, i) => {
          const correction = corrections[i];
          return correction?.changed ? { ...block, content: correction.corrected } : block;
        });
        const correctedDraft: ArticleDraft = { ...draft, blocks: correctedBlocks };

        await updateSession(user.id, opportunityId, { article: correctedDraft });
        publishDraft = correctedDraft;

        const residuals: BrandVoiceResidual[] = corrections
          .filter((cr) => cr.residualViolations?.length)
          .map((cr) => ({
            paragraphIndex: cr.paragraphIndex,
            violations: (cr.residualViolations ?? []).map((v) => ({
              type: v.type as string,
              match: v.match,
            })),
          }));
        brandVoiceStatus = residuals.length > 0
          ? { status: "partial", residuals }
          : { status: "clean" };
      } else {
        brandVoiceStatus = { status: "clean" };
      }
    } catch {
      brandVoiceStatus = { status: "error" };
    }
  }

  // ── GEO score — computed on the corrected draft ──
  let geoScore: GeoScore | null = null;
  if (publishDraft?.blocks?.length) {
    try {
      const plainText = blocksToPlainText(publishDraft.blocks);
      const articleResponse = blocksToGenerateArticleResponse(publishDraft);
      geoScore = computeGeoScore(plainText, publishDraft.title, articleResponse);
    } catch {
      // null signals unavailable to the caller
    }
  }

  // ── Publish to Sanity using the corrected draft ──
  const sessionForPublish = publishDraft !== draft
    ? { ...session, draft: publishDraft }
    : session;

  let documentId: string;
  let studioUrl: string;
  try {
    ({ documentId, studioUrl } = await publishToSanity(sessionForPublish, session.wpMetadata ?? null));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }

  await updateSession(user.id, opportunityId, {
    sentToWordPressAt: new Date().toISOString(),
  });

  return Response.json({
    id: documentId,
    link: studioUrl,
    title,
    status: "draft",
    brandVoiceStatus,
    geoScore,
    ...(publishDraft !== draft ? { correctedDraft: publishDraft } : {}),
  });
}

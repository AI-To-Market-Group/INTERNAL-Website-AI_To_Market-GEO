import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { getSession } from "@/lib/builder-sessions-store";
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

export async function POST(req: NextRequest, { params }: Params) {
  const { opportunityId } = await params;
  const { user, error } = await requireUser();
  if (error) return error;

  // Body draft is the primary source (current in-memory state from the client).
  // Fall back to DB only when no body draft is provided.
  const bodyRaw = await req.json().catch(() => ({})) as { draft?: ArticleDraft };
  const bodyDraft = bodyRaw?.draft ?? null;

  const session = bodyDraft ? null : await getSession(user.id, opportunityId);
  const draft: ArticleDraft | null =
    bodyDraft ?? (session?.draft as ArticleDraft | null) ?? null;

  if (!draft?.blocks?.length) {
    return err("No draft found. Generate an article first.", 404, "NOT_FOUND");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return err("OPENAI_API_KEY not configured.", 503, "SERVICE_UNAVAILABLE");
  }

  // ── Brand voice — detect + attempt correction to surface residuals; no session write ──
  let brandVoiceStatus: BrandVoiceStatus | undefined;
  try {
    const rawTexts = draft.blocks.map((b) =>
      (b.content ?? "").replace(/<[^>]+>/g, " ").trim()
    );
    const bvChecks = detectViolations(rawTexts);
    if (bvChecks.some((c) => c.violations.length > 0)) {
      const corrections = await correctViolations(rawTexts, bvChecks);
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

  // ── GEO score ──
  let geoScore: GeoScore | null = null;
  try {
    const plainText = blocksToPlainText(draft.blocks);
    const articleResponse = blocksToGenerateArticleResponse(draft);
    geoScore = computeGeoScore(plainText, draft.title, articleResponse);
  } catch {
    // null signals "unavailable" to the caller
  }

  return ok({ brandVoiceStatus, geoScore });
}

import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { checkBudget } from "@/lib/budget-guard";
import { getSession, updateSession } from "@/lib/builder-sessions-store";
import { chatJson } from "@/lib/openai-article";
import { getRefinementLengthPrompt } from "@/lib/article-length-controller";
import { shortenArticleToTarget } from "@/lib/article-shorten-agent";
import { getBrandVoicePrompt } from "@/lib/brand-voice";
import { detectViolations, correctViolations } from "@/lib/brand-voice-checker";
import { computeGeoScore } from "@/lib/geo-score";
import type { ArticleDraft, ArticleDraftBlock, GenerateArticleResponse, GeoScore } from "@/types";

type Params = { params: Promise<{ opportunityId: string }> };

function articleToPlainText(response: GenerateArticleResponse): string {
  return response.sections
    .flatMap((s) => [
      s.heading,
      ...s.content.paragraphs.map((p) => p.text.replace(/<[^>]+>/g, " ")),
      ...(s.content.bullets ?? []).map((b) => (typeof b === "string" ? b : "")),
    ])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RefinedSection {
  order: number;
  heading: string;
  paragraphs: string[];
}

interface RefinedArticle {
  title: string;
  sections: RefinedSection[];
}

type SectionGroup = { headingBlock: ArticleDraftBlock; paragraphBlocks: ArticleDraftBlock[] };

function groupBlocksIntoSections(blocks: ArticleDraftBlock[]): SectionGroup[] {
  const sections: SectionGroup[] = [];
  let current: SectionGroup | null = null;
  for (const block of blocks) {
    if (block.type === "heading") {
      if (current) sections.push(current);
      current = { headingBlock: block, paragraphBlocks: [] };
    } else if (current) {
      current.paragraphBlocks.push(block);
    }
  }
  if (current) sections.push(current);
  return sections;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { opportunityId } = await params;
  const { user, error } = await requireUser();
  if (error) return error;

  const budget = await checkBudget(user.id);
  if (!budget.allowed) {
    return err(`Monthly call limit reached (${budget.count} of ${budget.budget}). Update your limit in AI Usage.`, 429, "BUDGET_EXCEEDED");
  }

  // Accept draft from request body (current editor state) or fall back to session
  const body = await req.json().catch(() => ({})) as { draft?: ArticleDraft };
  let draft: ArticleDraft | null = body.draft ?? null;

  if (!draft) {
    const session = await getSession(user.id, opportunityId);
    draft = (session?.draft as ArticleDraft | null) ?? null;
  }

  if (!draft) {
    return err("No draft found. Please generate an article first.", 404, "NOT_FOUND");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return err("OPENAI_API_KEY not configured.", 503, "SERVICE_UNAVAILABLE");
  }

  const sections = groupBlocksIntoSections(draft.blocks);

  const inputSections = sections.map((s, i) => ({
    order: i + 1,
    heading: s.headingBlock.content,
    paragraphs: s.paragraphBlocks.map((p) => p.content),
  }));

  const currentWordCount = draft.blocks
    .map((b) => (b.content ?? "").replace(/<[^>]+>/g, " "))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  const system = `You are a senior editorial editor refining a draft article. Your goal: lift the writing to expert-level WITHOUT expanding its length and WITHOUT making it sound like consulting jargon.

${getBrandVoicePrompt()}

Apply ALL of the following refinement rules:

1. EDITORIAL TONE — Rewrite passive or vague sentences to be direct and specific. The voice should be a knowledgeable industry editor — concrete and practical, never McKinsey-style. Avoid the consulting cadence.

2. ELIMINATE FILLER — Remove the forbidden phrases listed in BRAND CONTEXT above. Do not add replacement padding — leave the text shorter.

3. DATA & SPECIFICITY — Replace vague claims with a concrete stat or product mention inline (same sentence length). Always attribute: "according to [real source, year]". Never fabricate company names or proprietary studies. Do NOT add new sentences just to insert stats.

4. CONCRETENESS — Where the text says "users" or "customers" or "the industry", swap for a specific actor when the context allows ("a B2B SaaS CMO", "a mid-market RevOps lead", "a content team scaling with AI tools", "an enterprise marketing director"). Specificity beats abstraction.

4b. ANTI-LAZINESS — If a paragraph or numbered step is just a rephrasing of an outline title (less than 25 substantive words, no concrete details, no example), you MUST enrich it inline: add a brand name, a tradeoff, a sensory detail, or a watch-out tip. Steal the words back from filler elsewhere in the same section to stay within the length budget. Lazy regurgitation of outline bullets is forbidden — readers can already read the outline.

5. ${getRefinementLengthPrompt(currentWordCount)}

6. PRESERVE STRUCTURE — Return EXACTLY ${sections.length} sections in the same order. Each section must have the EXACT SAME NUMBER of paragraphs as the input. Only rewrite text and optionally sharpen headings.

7. FAQ FORMAT (CRITICAL — MUST FOLLOW EXACTLY) — If a paragraph starts with "Q:" it is a FAQ entry. The output paragraph string in JSON MUST contain a literal newline character (\\n) between the question and the answer. Format: "Q: [question]\\nA: [answer]". The "\\n" must be encoded as a real JSON newline escape so the resulting string has a line break between Q: and A:. NEVER write "Q: ...?A: ..." with no separator. NEVER merge Q and A into one sentence. Keep answers to 2–3 sentences maximum.

8. PRESERVE GEO CITATIONS (CRITICAL) — If a paragraph contains a passage in the format "quoted text" — Source or "quoted text" — Source, Year, do NOT remove the quotation marks, do NOT remove the dash, and do NOT rewrite the attribution into inline form (e.g. "according to Source"). The entire citation block must survive verbatim. You may only rephrase surrounding sentences.

Return valid JSON only (no markdown):
{
  "title": "same or slightly sharpened title",
  "sections": [
    { "order": 1, "heading": "Section heading", "paragraphs": ["paragraph 1 text", "paragraph 2 text"] }
  ]
}`;

  const userPrompt = `Article title: ${draft.title}\n\nSections to refine:\n${JSON.stringify(inputSections, null, 2)}`;

  try {
    const refined = await chatJson<RefinedArticle>(system, userPrompt, "gpt-5.4", { userId: user.id, feature: "article-refine" });

    if (!refined?.sections || refined.sections.length !== sections.length) {
      return err("Refinement failed: section count mismatch. Please try again.", 500, "REFINE_FAILED");
    }

    // Repair FAQ paragraphs whose \n separator was dropped during refinement.
    // Also split run-on paragraphs that GPT crams with multiple Q/A pairs.
    const repairFaqText = (text: string): string => {
      if (!text.trimStart().startsWith("Q:")) return text;
      // If the text contains MULTIPLE Q: occurrences, keep only the first Q/A
      // (the route currently has 1 paragraph per array index — splitting would
      // change the array length and break the structure-preserving refine.
      // Better to truncate than to render run-on garbage in the accordion.)
      const secondQ = text.indexOf(" Q:", 3);
      const cleanText = secondQ > 0 ? text.slice(0, secondQ).trim() : text;
      if (cleanText.includes("\nA:")) return cleanText;
      return cleanText
        .replace(/([?.!])\s*A:\s*/, "$1\nA: ")
        .replace(/\s+A:\s*/, "\nA: ");
    };

    // Build a GenerateArticleResponse-shaped object so the shorten agent can work on it
    let refinedAsResponse: GenerateArticleResponse = {
      title: refined.title?.trim() || draft.title,
      sections: sections.map((original, i) => {
        const refinedSection = refined.sections[i];
        const sectionType = (original.headingBlock.meta as Record<string, unknown>)?.sectionType as string ?? "section";
        return {
          order: i + 1,
          type: sectionType,
          heading: refinedSection?.heading?.trim() || original.headingBlock.content,
          content: {
            paragraphs: original.paragraphBlocks.map((pb, j) => {
              const rawText = refinedSection?.paragraphs[j]?.trim() || pb.content;
              return {
                id: j + 1,
                text: sectionType === "faq" ? repairFaqText(rawText) : rawText,
              };
            }),
            bullets: [],
          },
        };
      }),
    };

    // ── Shorten agent: correct if refinement expanded the article ──
    if (currentWordCount > 0 && refinedAsResponse.sections.length > 0) {
      const ceiling = Math.round(currentWordCount * 1.05);
      try {
        refinedAsResponse = await shortenArticleToTarget(refinedAsResponse, ceiling);
      } catch (e) {
        console.error("[refine-draft] shorten agent failed:", e);
        // non-fatal
      }
    }

    // ── Brand voice correction — applied in-place before GEO scoring ──
    let brandVoiceStatus: import("@/types").BrandVoiceStatus | null = null;
    try {
      const positions: Array<{ si: number; type: "heading" | "para"; pi?: number }> = [];
      const rawTexts: string[] = [];
      for (let si = 0; si < refinedAsResponse.sections.length; si++) {
        const sec = refinedAsResponse.sections[si];
        positions.push({ si, type: "heading" });
        rawTexts.push(sec.heading);
        for (let pi = 0; pi < sec.content.paragraphs.length; pi++) {
          positions.push({ si, type: "para", pi });
          rawTexts.push(sec.content.paragraphs[pi].text);
        }
      }
      const bvChecks = detectViolations(rawTexts);
      if (bvChecks.some((c) => c.violations.length > 0)) {
        const corrections = await correctViolations(rawTexts, bvChecks);
        const residuals: import("@/types").BrandVoiceResidual[] = [];
        for (const cr of corrections) {
          if (cr.residualViolations?.length) {
            console.warn(
              `[refine-draft] paragraph ${cr.paragraphIndex} still has violations after 2 attempts:`,
              cr.residualViolations.map((v) => v.match).join(", ")
            );
            residuals.push({
              paragraphIndex: cr.paragraphIndex,
              violations: cr.residualViolations.map((v) => ({ type: v.type as string, match: v.match })),
            });
          }
          if (!cr.changed) continue;
          const pos = positions[cr.paragraphIndex];
          if (pos.type === "heading") {
            refinedAsResponse.sections[pos.si].heading = cr.corrected;
          } else if (pos.pi !== undefined) {
            refinedAsResponse.sections[pos.si].content.paragraphs[pos.pi].text = cr.corrected;
          }
        }
        brandVoiceStatus = residuals.length > 0
          ? { status: "partial", residuals }
          : { status: "clean" };
      } else {
        brandVoiceStatus = { status: "clean" };
      }
    } catch (e) {
      console.error("[refine-draft] brand voice correction failed:", e);
      brandVoiceStatus = { status: "error" };
    }

    // ── GEO score — computed on the corrected text ──
    let geoScore: GeoScore | null = null;
    try {
      geoScore = computeGeoScore(articleToPlainText(refinedAsResponse), refinedAsResponse.title, refinedAsResponse);
    } catch (e) {
      console.error("[refine-draft] geo scoring failed:", e);
    }

    // Reconstruct blocks from the (possibly shortened) response
    const refinedBlocks: ArticleDraftBlock[] = sections.flatMap((original, i) => {
      const finalSection = refinedAsResponse.sections[i];
      return [
        {
          ...original.headingBlock,
          content: finalSection?.heading || original.headingBlock.content,
        },
        ...original.paragraphBlocks.map((pb, j) => ({
          ...pb,
          content: finalSection?.content.paragraphs[j]?.text || pb.content,
        })),
      ];
    });

    const safeDraft: ArticleDraft = {
      ...draft,
      title: refinedAsResponse.title,
      blocks: refinedBlocks,
      updatedAt: new Date().toISOString(),
    };

    await updateSession(user.id, opportunityId, { article: safeDraft });
    return ok({ draft: safeDraft, geoScore, brandVoiceStatus });
  } catch (e) {
    return err(
      `Refinement failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      500,
      "REFINE_FAILED"
    );
  }
}

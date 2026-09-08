import type { NextRequest } from "next/server";
import { getSession, updateSession } from "@/lib/builder-sessions-store";
import { chatJsonStream } from "@/lib/openai-article";
import { requireUser } from "@/lib/api-auth";
import { checkBudget } from "@/lib/budget-guard";
import { err } from "@/lib/api-response";
import { reviewArticleQuality } from "@/lib/article-quality";
import { getGenerationLengthPrompt } from "@/lib/article-length-controller";
import { shortenArticleToTarget, countArticleWords } from "@/lib/article-shorten-agent";
import { getBrandVoicePrompt } from "@/lib/brand-voice";
import { detectViolations, correctViolations } from "@/lib/brand-voice-checker";
import { computeGeoScore } from "@/lib/geo-score";
import { mapGenerateArticleResponseToDraft } from "@/lib/article-builder-utils";
import type {
  OutlineSection,
  GenerateArticleResponse,
  GenerateArticleSectionOutput,
  GenerateArticleParagraph,
} from "@/types";

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

function mockArticleResponse(
  title: string,
  outline: OutlineSection[]
): GenerateArticleResponse {
  const sections: GenerateArticleSectionOutput[] = outline.map((sec, i) => ({
    order: i + 1,
    type: sec.type ?? "section",
    heading: sec.title,
    eyebrow: undefined,
    content: {
      paragraphs: [
        {
          id: i * 10 + 1,
          text: `${sec.title}: This section covers the key points. ${(sec.content ?? "").replace(/•\s*/g, " ").slice(0, 200)}`,
        },
      ],
      bullets: [],
    },
  }));
  return { title, sections };
}

function processResponse(raw: GenerateArticleResponse, articleTitle: string, outline: OutlineSection[]): GenerateArticleResponse {
  if (!raw.sections?.length) return mockArticleResponse(articleTitle, outline);

  // 1. Normalise each section — lowercase the type so all downstream checks are consistent
  const sections = raw.sections.map((s, i) => ({
    order: s.order ?? i + 1,
    type: (s.type ?? "section").toLowerCase(),
    heading: s.heading ?? outline[i]?.title ?? `Section ${i + 1}`,
    eyebrow: (() => {
      const raw = (s as { eyebrow?: string }).eyebrow;
      if (raw && raw.trim()) return raw.trim().toUpperCase();
      const matched = outline.find(o => o.title?.toLowerCase() === (s.heading ?? "").toLowerCase()) ?? outline[i];
      return matched?.eyebrow ?? undefined;
    })(),
    content: {
      paragraphs: (s.content?.paragraphs ?? []).map((p, j) => ({
        id: (p as GenerateArticleParagraph).id ?? i * 10 + j + 1,
        text: (p as GenerateArticleParagraph).text ?? "",
      })),
      bullets: s.content?.bullets ?? [],
    },
  }));

  // 2. Q/A rescue: GPT often leaks Q:/A: paragraphs into non-faq sections.
  //    Move them to the faq section so they render under the right heading.
  //    If a section becomes empty, backfill it from its outline bullets.
  const orphanFaq: { id: number; text: string }[] = [];
  for (const sec of sections) {
    if (sec.type === "faq" || /frequently.asked/i.test(sec.heading)) continue;
    const regular = sec.content.paragraphs.filter((p) => !p.text.trimStart().startsWith("Q:"));
    const faqLike = sec.content.paragraphs.filter((p) => p.text.trimStart().startsWith("Q:"));
    if (faqLike.length === 0) continue;

    if (regular.length > 0) {
      sec.content.paragraphs = regular;
      orphanFaq.push(...faqLike);
    } else {
      // All paragraphs were Q/A — move them to FAQ, leave the section
      // empty (rule 4 below will try to backfill from outline; if it can't,
      // the section heading will render alone — better than embarrassing fake prose).
      orphanFaq.push(...faqLike);
      sec.content.paragraphs = [];
    }
  }

  // 3. Bullet-only sections — how_to: convert to <ol> paragraph.
  //    conclusion: keep bullets in content.bullets so the frontend renders them
  //    as styled coral-dot items (never convert to HTML paragraph).
  for (const sec of sections) {
    if (sec.content.paragraphs.length > 0) continue;
    const bullets = (sec.content.bullets ?? []) as unknown[];
    if (bullets.length === 0) continue;

    const items = bullets
      .map((b) => {
        const text = typeof b === "string" ? b : (b as { text?: string })?.text ?? String(b);
        return text
          .trim()
          .replace(/^key\s*takeaways?\s*:\s*/i, "")
          .replace(/^takeaway\s*:\s*/i, "")
          .replace(/^(?:step\s*)?\d+[.)\]:]?\s*/i, "")
          .replace(/^[•\-*]\s*/, "")
          .trim();
      })
      .filter((s) => s.length > 0);

    if (items.length === 0) continue;

    // conclusion: leave bullets in place — renderer uses them directly
    if (/^conclusion$/i.test(sec.type)) {
      sec.content.bullets = items;
      continue;
    }

    // how_to: numbered ordered list
    const listTag = sec.type === "how_to" ? "ol" : "ul";
    const listHtml = `<${listTag}>${items.map((s) => `<li>${s}</li>`).join("")}</${listTag}>`;
    sec.content.paragraphs = [{ id: sec.order * 10 + 1, text: listHtml }];
    sec.content.bullets = [];
  }

  // 4. True empty-section backfill: if a section is STILL empty (no paragraphs,
  //    no bullets), pull prose from the outline bullets so the section heading
  //    isn't followed by a void.
  for (const sec of sections) {
    if (sec.content.paragraphs.length > 0) continue;
    const outlineSec = outline.find((o) => o.title === sec.heading) ?? outline[sec.order - 1];
    const bulletProse = outlineSec?.content
      ? outlineSec.content
          .split("\n")
          .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
          .filter(Boolean)
          .filter((l) => !/^(what to cover|angle|avoid)\s*:/i.test(l))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    if (bulletProse) {
      sec.content.paragraphs = [{ id: sec.order * 10 + 1, text: bulletProse }];
    }
    // If still nothing, leave empty rather than write embarrassing placeholder
  }

  // 4. Place orphan Q/A into the faq section (or create one)
  if (orphanFaq.length > 0) {
    const faqIdx = sections.findIndex((s) => s.type === "faq" || /frequently.asked/i.test(s.heading));
    if (faqIdx >= 0) {
      sections[faqIdx].content.paragraphs = [
        ...orphanFaq,
        ...sections[faqIdx].content.paragraphs,
      ];
    } else {
      sections.push({
        order: sections.length + 1,
        type: "faq",
        heading: "Frequently Asked Questions",
        eyebrow: undefined,
        content: { paragraphs: orphanFaq, bullets: [] },
      });
    }
  }

  // 5. Normalise FAQ paragraphs:
  //    a) Split RUN-ON paragraphs that contain multiple "Q: ... A: ..." pairs
  //       into separate paragraphs (GPT sometimes crams 3-4 Q/A into one string,
  //       breaking the FAQ accordion rendering)
  //    b) Ensure every Q: paragraph has the \nA: separator
  for (const sec of sections) {
    if (sec.type !== "faq" && !/frequently.asked/i.test(sec.heading)) continue;

    const expanded: typeof sec.content.paragraphs = [];
    for (const p of sec.content.paragraphs) {
      const text = p.text;
      if (!text.trimStart().startsWith("Q:")) {
        expanded.push(p);
        continue;
      }

      // Split when we find another "Q:" later in the string (run-on case).
      // Lookahead matches whitespace+Q: that comes AFTER the first character.
      const parts = text
        .split(/(?<=[\s\S])(?=\s+Q:\s)/g)
        .map((s) => s.trim())
        .filter(Boolean);

      parts.forEach((part, i) => {
        // Ensure \nA: separator
        let fixed = part;
        if (!fixed.includes("\nA:")) {
          fixed = fixed
            .replace(/([?.!])\s*A:\s*/, "$1\nA: ")
            .replace(/\s+A:\s*/, "\nA: ");
        }
        expanded.push({ id: p.id + i, text: fixed });
      });
    }
    sec.content.paragraphs = expanded;
  }

  return { title: raw.title ?? articleTitle, sections };
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const budget = await checkBudget(user.id);
  if (!budget.allowed) {
    return err(`Monthly call limit reached (${budget.count} of ${budget.budget}). Update your limit in AI Usage.`, 429, "BUDGET_EXCEEDED");
  }

  const { opportunityId } = await params;
  const body = (await req.json()) as { outline?: OutlineSection[] };
  const outline = body.outline ?? [];
  const session = await getSession(user.id, opportunityId);
  const articleTitle = session?.topicTitle ?? "Article";
  const ctx = session?.opportunityContext;
  const targetKeywords = ctx?.tags ?? [];

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || outline.length === 0) {
    const mock = mockArticleResponse(articleTitle, outline.length ? outline : [{ id: "1", headingLevel: "H2", title: "Introduction", bullets: [], type: "introduction" }]);
    const qualityFlags = reviewArticleQuality(mock, targetKeywords);
    // Persist the mock too — without this, refresh would lose it
    await updateSession(user.id, opportunityId, {
      article: mapGenerateArticleResponseToDraft(mock),
      currentStep: 2,
    });
    return Response.json({ ...mock, quality_flags: qualityFlags });
  }

  const outlineText = outline
    .map((s, i) => {
      const kws = s.seo?.keywords?.length ? `\n   Keywords: ${s.seo.keywords.join(", ")}` : "";
      return `${i + 1}. ${s.title}\n${(s.content ?? "").split("\n").map((l) => `   ${l}`).join("\n")}${kws}`;
    })
    .join("\n\n");

  const articleContextBlock = ctx
    ? [
        "ARTICLE CONTEXT",
        "---------------",
        ctx.intents?.length ? `Editorial intent: ${ctx.intents.join(", ")}` : "",
        ctx.content_brief ? `Why this topic now: ${ctx.content_brief}` : "",
        ctx.justification_signals?.length ? `Content gap: ${ctx.justification_signals.join("; ")}` : "",
        ctx.tags?.length ? `Target keywords: ${ctx.tags.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const system = `You are a GEO (Generative Engine Optimization) content writer. Write in English. Output a full article as JSON only (no markdown). Goal: produce content AI search engines (ChatGPT, Perplexity, Claude, Gemini) will cite as authoritative.

${getBrandVoicePrompt()}

Return valid JSON in this exact shape:
{
  "title": "Article title (specific, scenario-driven — never 'The Ultimate Guide to X')",
  "sections": [
    {
      "order": 1,
      "type": "introduction|section|faq|stats|how_to|conclusion",
      "heading": "Section heading",
      "content": {
        "paragraphs": [{"id": 1, "text": "Full paragraph text."}],
        "bullets": []
      }
    }
  ]
}

CRITICAL — THE OUTLINE IS SCAFFOLDING, NOT CONTENT
The outline bullets describe WHAT to cover. Your job is to write the actual article. NEVER quote outline bullets back as the final content with minor rephrasing — that produces lazy, useless articles. Every outline bullet must become substantial new content with details GPT adds: a specific tool or platform name, a real-world workflow example, a mechanism explanation, a tradeoff acknowledgment, or a "watch out for" tip. If the outline says "use agentic automation", you write WHY it works, WHEN it breaks down, and what specific tool or workflow pattern (n8n, Make, Claude, GPT-4o) fits each use case.

WRITING RULES:
- Open the INTRODUCTION with a real scenario, an industry tension, or a specific product moment — NOT "X is a Y that does Z" definition.
- Inside body sections, include at least one quotable sentence with a clear claim (e.g. "AI-generated outreach emails reduced sales cycle length by 34% in a 6-month pilot because the model learned rep-specific follow-up timing from CRM history"). Avoid the formulaic "X is Y because Z" on every section.
- Use "According to research" / "Studies show" AT MOST TWICE. For other evidence, name the source: "According to Gartner 2024", "According to Bain 2024", "According to Pew Research Center 2024".
- Format expert quotes as: "— Source/Year"
- Use 1–2 anchor phrases sparingly: "In summary:", "Specifically:", "Bottom line:". Do NOT put "Bottom line:" on every section.

SECTION-TYPE RULES (each one MUST add value beyond the outline):

- For "faq" sections (CRITICAL FORMAT — MUST FOLLOW EXACTLY):
  * Each Q/A pair is its OWN paragraph object in the JSON paragraphs array.
  * NEVER concatenate multiple Q/A pairs into a single paragraph string.
  * Format of each paragraph string: "Q: [question]\\nA: [answer]" with a real newline between Q and A.
  * Each answer is 2–3 sentences MAX (40–60 words). Hard limit. If you write more, cut.
  * Each answer must contain a fact NOT in the outline.
  * If the outline asks for 4 questions, return EXACTLY 4 paragraph objects, each containing one Q/A pair.
  * Wrong: paragraphs: ["Q: A1?\\nA: ans1. Q: A2?\\nA: ans2."]  (this packs 2 Q/A into one string — FORBIDDEN)
  * Right: paragraphs: ["Q: A1?\\nA: ans1.", "Q: A2?\\nA: ans2."]  (each Q/A is its own array element)

- For "stats" sections: each stat is 2–3 sentences in this format: "[number/%] [context], according to [Named Source, Year]. [One sentence of concrete implication or tradeoff for the audience — e.g. why this number matters for a B2B marketing leader, or what it means for a team adopting AI tools]." A bare stat with just attribution is INSUFFICIENT — every stat needs the implication sentence.

- For "how_to" sections: use the bullets array. Each step is formatted as: "N. [Short action title]: [40–60 word elaboration that adds at least ONE of: a specific tool/platform name, a real-world workflow example, a watch-out tip, or a mechanism explanation]." The elaboration must contain information NOT present in the outline. A bare step like "Pick an automation tool" is FORBIDDEN — write "Pick the automation tool that fits the team: n8n suits teams that need custom logic and low cost per run, Make suits marketing ops teams that want drag-and-drop speed. Avoid evaluating more than two options in parallel — tool paralysis kills sprint momentum." That's the bar.

- For "introduction": 60–100 words, hook-driven, NOT a definition opener.
- For "conclusion": The "heading" MUST be a punchy, opinionated one-liner that captures the article's central thesis — NOT "Key Takeaways" or any generic label (e.g. "The teams that win citations build proof into the workflow"). The bullets array contains 3–5 short, actionable takeaways — plain sentences, no "Key Takeaway:" prefix.
- For other "section" types: 2–3 paragraphs (60–80 words each) of real specific content using brand and product names from the outline.

Every section must have at least one paragraph or one bullet entry. Use outline bullets as content scaffolding — never ignore them, never quote them.
${getGenerationLengthPrompt(outline.length)}`;

  const userPrompt = [
    `Article title: ${articleTitle}`,
    articleContextBlock ? `\n${articleContextBlock}` : "",
    `\nOutline:\n${outlineText}`,
  ].join("");

  const TARGET_WORDS = 900;

  const stream = chatJsonStream(system, userPrompt, "gpt-5.4-mini", async (accumulated) => {
    let response: GenerateArticleResponse;
    try {
      response = processResponse(JSON.parse(accumulated) as GenerateArticleResponse, articleTitle, outline);
    } catch {
      response = mockArticleResponse(articleTitle, outline);
    }

    // ── Shorten agent: correct length if GPT overshot ──
    if (countArticleWords(response) > TARGET_WORDS) {
      try {
        response = await shortenArticleToTarget(response, TARGET_WORDS);
      } catch (e) {
        console.error("[validate-plan] shorten agent failed:", e);
        // non-fatal — keep the over-length article rather than crashing
      }
    }

    // ── Brand voice correction — applied in-place before quality + GEO ──
    let brand_voice_status: import("@/types").BrandVoiceStatus | null = null;
    try {
      const positions: Array<{ si: number; type: "heading" | "para"; pi?: number }> = [];
      const rawTexts: string[] = [];

      for (let si = 0; si < response.sections.length; si++) {
        const sec = response.sections[si];
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
              `[validate-plan] paragraph ${cr.paragraphIndex} still has violations after 2 attempts:`,
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
            response.sections[pos.si].heading = cr.corrected;
          } else if (pos.pi !== undefined) {
            response.sections[pos.si].content.paragraphs[pos.pi].text = cr.corrected;
          }
        }
        brand_voice_status = residuals.length > 0
          ? { status: "partial", residuals }
          : { status: "clean" };
      } else {
        brand_voice_status = { status: "clean" };
      }
    } catch (e) {
      console.error("[validate-plan] brand voice correction failed:", e);
      brand_voice_status = { status: "error" };
    }

    const qualityFlags = reviewArticleQuality(response, targetKeywords);

    // ── Normalise FAQ paragraph text to canonical "Q: ...\nA: ..." format ──
    // The mini model often emits "Question?: Answer" or "Question?Answer" instead
    // of the instructed Q:/A: labels. Normalise here so both the persisted draft
    // and the SSE payload render correctly without needing a refine pass.
    for (const sec of response.sections) {
      if (sec.type !== "faq") continue;
      for (const para of sec.content.paragraphs) {
        const t = para.text;
        if (t.startsWith("Q:") || t.includes("\nA:")) continue; // already canonical
        // "Question?: Answer" — colon after question mark
        const qColon = t.match(/^([\s\S]+?\?): +([\s\S]+)$/);
        if (qColon) { para.text = `Q: ${qColon[1].trim()}\nA: ${qColon[2].trim()}`; continue; }
        // "Question?Answer" — question mark directly followed by capital letter
        const qUpper = t.match(/^([\s\S]+?\?)([A-Z][\s\S]+)$/);
        if (qUpper) { para.text = `Q: ${qUpper[1].trim()}\nA: ${qUpper[2].trim()}`; continue; }
      }
    }

    // ── Persist the generated article to Supabase ──
    // Without this, the article is sent to the client but never saved, so it
    // disappears on refresh (the page-level autosave only fires on step change
    // or unmount, which is fragile). Saving here is the source of truth.
    const draftToPersist = mapGenerateArticleResponseToDraft(response);
    await updateSession(user.id, opportunityId, {
      article: draftToPersist,
      currentStep: 2,
    });

    // ── GEO score — runs after article is finalised ──
    let geo_score = null;
    try {
      geo_score = computeGeoScore(articleToPlainText(response), articleTitle, response);
    } catch (e) {
      console.error("[validate-plan] geo scoring failed:", e);
    }

    return { article: response, quality_flags: qualityFlags, geo_score, brand_voice_status };
  }, { userId: user.id, feature: "article-draft" });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

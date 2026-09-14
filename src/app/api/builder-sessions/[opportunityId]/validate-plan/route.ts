import type { NextRequest } from "next/server";
import { getSession, updateSession } from "@/lib/builder-sessions-store";
import { chatJsonStream } from "@/lib/openai-article";
import { requireUser } from "@/lib/api-auth";
import { checkBudget } from "@/lib/budget-guard";
import { err } from "@/lib/api-response";
import { reviewArticleQuality } from "@/lib/article-quality";
import { getGenerationLengthPrompt } from "@/lib/article-length-controller";
import { shortenArticleToTarget, countArticleWords } from "@/lib/article-shorten-agent";
import { getBrandVoicePrompt, getWordCountTargets } from "@/lib/brand-voice";
import { detectViolations, correctViolations } from "@/lib/brand-voice-checker";
import { computeGeoScore } from "@/lib/geo-score";
import { mapGenerateArticleResponseToDraft } from "@/lib/article-builder-utils";
import { searchForCitation, rewriteWithCitation } from "@/lib/citation-finder";
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
      // Defensive: the schema example only shows an empty "bullets": [] with no
      // populated-item example, so the model occasionally mirrors the nearby
      // {id, text} paragraph shape instead of plain strings. Coerce anything
      // that isn't already a string so the client never renders "[object Object]".
      bullets: (s.content?.bullets ?? []).map((b) => {
        if (typeof b === "string") return b;
        if (b && typeof b === "object") {
          const obj = b as Record<string, unknown>;
          const text = obj.text ?? obj.content ?? obj.value ?? obj.finding;
          if (typeof text === "string") return text;
        }
        return String(b ?? "").trim();
      }).filter((b) => b && b !== "[object Object]"),
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

  // 3b. Conclusion with prose in paragraphs — extract as bullet sentences so the
  //     renderer always gets content.bullets for the coral-dot list.
  for (const sec of sections) {
    if (!/^conclusion$/i.test(sec.type)) continue;
    if ((sec.content.bullets ?? []).length > 0) continue; // already has bullets
    if (sec.content.paragraphs.length === 0) continue;
    const extracted: string[] = [];
    for (const para of sec.content.paragraphs) {
      const raw = para.text.replace(/<[^>]+>/g, "").trim();
      if (!raw) continue;
      const sentences = raw.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
      extracted.push(...sentences);
    }
    if (extracted.length > 0) {
      sec.content.bullets = extracted;
      sec.content.paragraphs = [];
    }
  }

  // 3c. Stats sections — if the LLM buried the number after a citation preamble
  //     ("According to Gartner (2024), 85%…"), reorder so the number leads.
  //     Paragraphs with no extractable number are left untouched; the renderer
  //     drops them from the stat-card grid and renders them as plain text instead.
  const STAT_NUMBER_RE = /(\$[\d,.]+\s*(?:billion|million|trillion|[bBmMtTkK])\b|\b\d[\d,.]*\s*(?:%|[xX]\b|×|\+)|\b\d[\d,.]*\s*(?:billion|million|trillion|thousand)\b)/i;
  // Matches "According to X (YYYY)," or "Per X," preambles at sentence start
  const CITATION_PREAMBLE_RE = /^(?:according\s+to\s+[\w\s]+(?:\(\d{4}\))?,\s*|per\s+[\w\s]+,\s*)/i;
  for (const sec of sections) {
    if (!/^stats$/i.test(sec.type)) continue;
    for (const para of sec.content.paragraphs) {
      const clean = para.text.replace(/<[^>]+>/g, "").trim();
      // Number already leads — no change needed
      if (STAT_NUMBER_RE.test(clean.slice(0, 15))) continue;
      // Number present but buried after a preamble — strip the preamble so number leads
      if (STAT_NUMBER_RE.test(clean) && CITATION_PREAMBLE_RE.test(clean)) {
        para.text = para.text.replace(CITATION_PREAMBLE_RE, "");
        // Capitalise the first character of the new leading text
        para.text = para.text.charAt(0).toUpperCase() + para.text.slice(1);
      }
      // No number at all — leave unchanged; renderer handles gracefully
    }
  }

  // 4. True empty-section backfill: if a section is STILL empty (no paragraphs,
  //    no bullets), pull prose from the outline bullets so the section heading
  //    isn't followed by a void.
  //    Note: every outline line is prefixed "What to cover:"/"Angle:"/"Avoid:" —
  //    only "Avoid:" (pitfalls to skip) should be dropped wholesale; the other
  //    two carry real scaffolding content and must have just their label stripped,
  //    not the whole line discarded (that previously zeroed out every fallback).
  for (const sec of sections) {
    const isConclusion = /^conclusion$/i.test(sec.type);
    if (sec.content.paragraphs.length > 0) continue;
    if (isConclusion && sec.content.bullets.length > 0) continue; // already backfilled by step 3/3b
    const outlineSec = outline.find((o) => o.title === sec.heading) ?? outline[sec.order - 1];
    const usableLines = outlineSec?.content
      ? outlineSec.content
          .split("\n")
          .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
          .filter(Boolean)
          .filter((l) => !/^avoid\s*:/i.test(l))
          .map((l) => l.replace(/^(?:what to cover|angle)\s*:\s*/i, "").trim())
          .filter(Boolean)
      : [];
    if (usableLines.length === 0) continue; // still nothing — leave empty rather than write embarrassing placeholder
    if (isConclusion) {
      sec.content.bullets = usableLines;
    } else {
      sec.content.paragraphs = [{ id: sec.order * 10 + 1, text: usableLines.join(" ") }];
    }
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

  // 5. Normalise FAQ paragraphs by pooling and re-extracting Q:/A: pairs from
  //    scratch, rather than splitting each paragraph in place. GPT's paragraph
  //    boundaries for FAQ content are unreliable in several ways: it crams
  //    multiple "Q: ... A: ..." pairs into one paragraph, splits a single pair
  //    across two paragraphs, or lets an answer leak into its own paragraph
  //    without its question (so the paragraph starts with "A:", not "Q:").
  //    The previous approach only fixed paragraphs that already started with
  //    "Q:", silently leaving "A:"-first paragraphs (and their garbled
  //    neighbours) untouched. Pooling all paragraph text into one string and
  //    re-deriving clean pairs from it is robust to all of the above, since it
  //    no longer depends on where GPT happened to put paragraph breaks.
  for (const sec of sections) {
    if (sec.type !== "faq" && !/frequently.asked/i.test(sec.heading)) continue;
    if (sec.content.paragraphs.every((p) => !p.text.includes("Q:") && !p.text.includes("A:"))) continue;

    const combined = sec.content.paragraphs.map((p) => p.text).join(" ");
    const pairRe = /Q:\s*([\s\S]*?)\s*A:\s*([\s\S]*?)(?=\s*Q:\s|$)/g;
    const pairs: typeof sec.content.paragraphs = [];
    const baseId = sec.content.paragraphs[0]?.id ?? 0;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = pairRe.exec(combined)) !== null) {
      // A missing-answer gap (a "Q:" immediately followed by another "Q:" with
      // no "A:" between) makes the regex swallow the second "Q:" into group 1 —
      // strip that trailing marker rather than showing it as part of the question.
      const q = match[1].replace(/\s*Q:\s*$/, "").trim();
      const a = match[2].trim();
      if (q.length >= 5 && a.length >= 5) {
        pairs.push({ id: baseId + i, text: `Q: ${q}\nA: ${a}` });
        i++;
      }
    }
    if (pairs.length > 0) sec.content.paragraphs = pairs;
  }

  return { title: raw.title ?? articleTitle, sections };
}

function parseOneShotHints(contentBrief: string | undefined): { targetWords?: number; flagModifiers: string[] } {
  if (!contentBrief) return { flagModifiers: [] };
  const targetWordsMatch = contentBrief.match(/^TARGET_WORDS:\s*(\d+)/m);
  const flagsMatch = contentBrief.match(/^FLAGS:\s*(.+)/m);
  const FLAG_MAP: Record<string, string> = {
    "Inject FAQ schema": "After the FAQ section, output a JSON-LD FAQPage schema block as a paragraph with id 9999 and text starting with <script type=\"application/ld+json\">.",
    "Add comparison table": "In the most appropriate body section, include an HTML <table> comparison (2-4 columns, 3-5 rows) embedded as a paragraph.",
    "Require 3 citable sources": "Cite at least 3 named external sources in format 'According to [Named Source, Year]'. Do not use generic 'According to research' more than once.",
    "Write answer block per section": "Begin every non-introduction, non-conclusion section with a 1–2 sentence direct answer block (bold the key claim) before expanding into full paragraphs.",
  };
  const activeFlags = flagsMatch ? flagsMatch[1].split(",").map(f => f.trim()).filter(Boolean) : [];
  const flagModifiers = activeFlags.map(f => FLAG_MAP[f]).filter(Boolean);
  return {
    targetWords: targetWordsMatch ? parseInt(targetWordsMatch[1]) : undefined,
    flagModifiers,
  };
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
  const wordCountTargets = await getWordCountTargets();
  const { targetWords, flagModifiers } = parseOneShotHints(ctx?.content_brief);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || outline.length === 0) {
    const mock = mockArticleResponse(articleTitle, outline.length ? outline : [{ id: "1", headingLevel: "H2", title: "Introduction", bullets: [], type: "introduction" }]);
    const qualityFlags = reviewArticleQuality(mock, targetKeywords, wordCountTargets);
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

${await getBrandVoicePrompt()}

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

"bullets" is ALWAYS an array of plain strings — one sentence per string, e.g. "bullets": ["First takeaway, a complete sentence.", "Second takeaway, a complete sentence."]. NEVER an array of objects — no {"id":..., "text":...} shape there (that shape is only for "paragraphs"). Leave "bullets" as [] unless the section type below says to use it.

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

- For "stats" sections: EVERY paragraph MUST open with a specific number or percentage — this is a hard requirement. Format: "[number/% with unit] [context], according to [Named Source, Year]. [One sentence of concrete implication]." WRONG: "According to Gartner (2024), 85% of AI projects fail." RIGHT: "85% of AI projects fail to reach production value, according to Gartner (2024). For B2B teams, this means validating AI tools in a live workflow before committing to a vendor." A paragraph with no extractable number (%, $, ×, billion, million) is a failure — do not generate it.

- For "how_to" sections: use the bullets array. Each step is formatted as: "N. [Short action title]: [40–60 word elaboration that adds at least ONE of: a specific tool/platform name, a real-world workflow example, a watch-out tip, or a mechanism explanation]." The elaboration must contain information NOT present in the outline. A bare step like "Pick an automation tool" is FORBIDDEN — write "Pick the automation tool that fits the team: n8n suits teams that need custom logic and low cost per run, Make suits marketing ops teams that want drag-and-drop speed. Avoid evaluating more than two options in parallel — tool paralysis kills sprint momentum." That's the bar.

- For "introduction": 60–100 words, hook-driven, NOT a definition opener.
- For "conclusion": The "heading" MUST be a punchy, opinionated one-liner that captures the article's central thesis — NOT "Key Takeaways" or any generic label (e.g. "The teams that win citations build proof into the workflow"). The bullets array contains 3–5 short, actionable takeaways — plain sentences, no "Key Takeaway:" prefix.
- For other "section" types: 2–3 paragraphs (60–80 words each) of real specific content using brand and product names from the outline.

Every section must have at least one paragraph or one bullet entry. Use outline bullets as content scaffolding — never ignore them, never quote them.
${getGenerationLengthPrompt(outline.length, targetWords)}${flagModifiers.length ? `\n\nONE-SHOT FLAGS (apply all):\n${flagModifiers.map((m, i) => `${i + 1}. ${m}`).join("\n")}` : ""}`;

  const userPrompt = [
    `Article title: ${articleTitle}`,
    articleContextBlock ? `\n${articleContextBlock}` : "",
    `\nOutline:\n${outlineText}`,
  ].join("");

  const TARGET_WORDS = 900;

  const stream = chatJsonStream(system, userPrompt, "gpt-5.4-mini", async (accumulated, sendEvent) => {
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

    sendEvent({ stage: "brand_voice" });

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

    sendEvent({ stage: "citation" });

    // ── Auto-embed citation so "Cited claims" GEO check passes from the start ──
    // Non-fatal: if the web search or rewrite fails for every candidate, the
    // article still ships without a hyperlinked citation. Tries the 2 longest
    // body paragraphs (across all non-intro/faq/conclusion sections) rather
    // than only the single longest one — the search-preview model frequently
    // can't verify a source for a given claim, and a single silent attempt
    // meant most articles shipped with zero clickable citations.
    try {
      const bodySections = response.sections.filter(
        (s) => !["introduction", "faq", "conclusion"].includes(s.type)
      );
      const candidates = bodySections
        .flatMap((s) => s.content.paragraphs.map((p) => ({ section: s, para: p })))
        .sort((a, b) => b.para.text.length - a.para.text.length)
        .slice(0, 2);

      console.log(`[auto-citation] trying ${candidates.length} candidate paragraph(s)`);
      for (const { section, para } of candidates) {
        const claim = para.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
        const citation = await searchForCitation(claim, apiKey!);
        if (!citation) {
          console.warn("[auto-citation] no verifiable source found for candidate");
          continue;
        }
        console.log(`[auto-citation] found: ${citation.source} (${citation.year}) → ${citation.url}`);
        const newText = await rewriteWithCitation(para.text, citation, {
          userId: user.id,
          feature: "auto-citation",
        });
        if (!newText) {
          console.warn("[auto-citation] rewrite returned nothing");
          continue;
        }
        const idx = section.content.paragraphs.findIndex((p) => p.id === para.id);
        if (idx >= 0) {
          section.content.paragraphs[idx].text = newText;
          console.log(`[auto-citation] embedded, hyperlinked=${/<a\s+href=/i.test(newText)}`);
        }
        break; // succeeded — no need to try the second candidate
      }
    } catch (e) {
      console.warn("[validate-plan] auto-citation failed (non-fatal):", e);
    }

    sendEvent({ stage: "scoring" });

    const qualityFlags = reviewArticleQuality(response, targetKeywords, wordCountTargets);

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

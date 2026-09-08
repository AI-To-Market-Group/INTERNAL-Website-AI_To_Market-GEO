import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { chatJson } from "@/lib/openai-article";

type Params = { params: Promise<{ opportunityId: string }> };

interface GeneratedParagraph { id: number; text: string; }
interface GeneratedSection {
  order: number; type: string; heading: string;
  content: { paragraphs: GeneratedParagraph[]; bullets: string[] };
}

// ── Thin-section expansion prompts ──────────────────────────────────────────

const THIN_PROMPTS: Record<string, (minWords: number) => string> = {
  introduction: (min) => `You are a GEO content editor. The introduction is too short — expand it to at least ${min} words.
Add: a more developed real-world scenario or industry tension, one concrete example with a company or tool name, and a clearer hook.
Keep existing sentences. Do NOT add a heading. Return an array of plain-text paragraph strings only.
Respond with JSON only: { "paragraphs": ["<p1 text>", "<p2 text>"] }`,

  section: (min) => `You are a GEO content editor. This body section is too short — expand it to at least ${min} words.
Add: (1) a deeper mechanism explanation, (2) a concrete example with a specific tool/platform/company, (3) a watch-out tip or tradeoff.
Keep existing sentences and add to them. Do NOT change the heading.
Respond with JSON only: { "paragraphs": ["<p1 text>", "<p2 text>", "<p3 text>"] }`,

  comparison: (min) => `You are a GEO content editor. This comparison section is too short — expand it to at least ${min} words.
Add a third comparison dimension, a concrete decision scenario, and a recommendation for a specific use case.
Keep existing content and extend it. Do NOT change the heading.
Respond with JSON only: { "paragraphs": ["<p1 text>", "<p2 text>"] }`,

  how_to: (min) => `You are a GEO content editor. This how-to section is too short — expand it to at least ${min} words.
For each existing step, add a tool name, a watch-out, or a timing note. Add 1-2 new steps if needed.
Respond with JSON only: { "paragraphs": ["<step text>", "<step text>"] }`,

  stats: (min) => `You are a GEO content editor. This stats section is too short — expand it to at least ${min} words.
Add 2 more statistics, each with: the number, a named source (Gartner, McKinsey, Forrester, Salesforce, IDC), and a one-sentence implication for the reader.
Format: "[stat] per [Source] ([Year]). [Implication sentence]."
Respond with JSON only: { "paragraphs": ["<stat paragraph>", "<stat paragraph>"] }`,

  conclusion: (min) => `You are a GEO content editor. The conclusion is too short — expand it to at least ${min} words.
Add 2-3 more specific, actionable key takeaways as bullet strings. Each should give a concrete next step.
Respond with JSON only: { "paragraphs": ["<takeaway>", "<takeaway>"] }`,

  faq: (min) => `You are a GEO content editor. The FAQ section is too short — expand it to at least ${min} words.
Add 2 more Q/A pairs. Each answer: 2-3 sentences (40-60 words), adds a fact not elsewhere in the article.
Format each paragraph as "Q: [question]\\nA: [answer]"
Respond with JSON only: { "paragraphs": ["Q: q1\\nA: a1", "Q: q2\\nA: a2"] }`,
};

// ── GEO check fix prompts ────────────────────────────────────────────────────

// Attribution format note: the GEO scorer's NAMED_SOURCE_RE matches these patterns:
//   "according to Gartner (2024)"  "per McKinsey (2024)"  "Forrester (2024)"
//   "LinkedIn 2024"  "(Bain, 2024)"  "— Gartner 2024"
// The LLM MUST use one of those exact formats or the scorer will miss the match.

const ATTRIBUTION_FORMAT_RULES = `
ATTRIBUTION FORMAT — use one of these exactly (the scoring system only recognises these patterns):
  • "According to Gartner (2024), ..."
  • "per McKinsey (2025), ..."
  • "Forrester (2024) found that ..."
  • "LinkedIn (2024) reports ..."
  • "... per IDC (2024)"
  • "... (Bain, 2024)"
Choose a source that fits the claim: Gartner/Forrester for tech/software adoption, McKinsey/Bain for strategy/ROI, LinkedIn/HubSpot for sales & marketing, IDC for market size, Salesforce for CRM/revenue data, Deloitte/PwC for enterprise transformation.
Use 2024 or 2025 — never an older year.`;

const SNIPPET_FORMAT_RULE = `
Return the FULL updated paragraph text in "newText". For "snippet", copy the first 60 characters of the ORIGINAL paragraph verbatim (the system uses this to find the right paragraph — it must match exactly).`;

const GEO_FIX_PROMPTS: Record<string, string> = {
  "Named sources": `You are a GEO content editor improving a B2B article's source attribution so AI search engines will cite it.

TASK: Find 2 paragraphs that make factual claims without a named source and embed an attribution into each sentence naturally — do NOT append a new sentence at the end.
${ATTRIBUTION_FORMAT_RULES}
${SNIPPET_FORMAT_RULE}

Respond with JSON only:
{ "snippetFixes": [
  { "snippet": "<first 60 chars of original paragraph>", "newText": "<full paragraph with attribution embedded>" },
  { "snippet": "<first 60 chars of another paragraph>", "newText": "<full paragraph with attribution embedded>" }
] }`,

  "Statistics with sources": `You are a GEO content editor strengthening a B2B article's data credibility.

TASK: Find the paragraph best suited for a specific sourced statistic, then rewrite it to include one real, plausible numeric claim attributed to a named source. The stat must fit the paragraph's existing topic — no generic filler.
${ATTRIBUTION_FORMAT_RULES}
${SNIPPET_FORMAT_RULE}

Respond with JSON only:
{ "snippetFixes": [
  { "snippet": "<first 60 chars of original paragraph>", "newText": "<full paragraph with the sourced stat naturally embedded>" }
] }`,

  "Cited claims": `You are a GEO content editor. Add one cited claim to the article.
Find the best paragraph to add "according to [Source], [claim]" or a brief quoted finding.
Keep surrounding prose intact.
Respond with JSON only: { "sectionHeading": "<exact heading>", "paragraphId": <id>, "newText": "<full updated paragraph text>" }`,

  "AI-tell density": `You are a GEO content editor removing ALL AI-generated phrasing from an article.
Scan every paragraph for AI-tell words/phrases: "thought leaders", "showcasing", "highlighting", "game-changing", "leveraging", "in today's landscape", "it is widely believed", "unlock", "revolutionize", "harness", "cutting-edge", "empower", "transformative", "elevate", "seamlessly".
Rewrite UP TO 3 paragraphs — the worst offenders — in direct, specific language: concrete claims, named tools or companies, no vague qualifiers. Leave all other paragraphs unchanged.
Respond with JSON only: { "fixes": [{ "sectionHeading": "<exact section heading>", "paragraphId": <id>, "newText": "<full rewritten paragraph text>" }] }`,

  "FAQ fan-out coverage": `You are a GEO content editor. The FAQ section needs more Q/A pairs for AI fan-out coverage.
Add 2 new Q/A pairs to the FAQ section. Format each as "Q: [question]\\nA: [2-3 sentence answer with a specific fact]".
Return them as new paragraphs to append to the FAQ section.
Respond with JSON only: { "sectionHeading": "<exact FAQ section heading>", "appendParagraphs": ["Q: q1\\nA: a1", "Q: q2\\nA: a2"] }`,
};

type Params2 = Params;

export async function POST(req: NextRequest, { params }: Params2) {
  const { user, error } = await requireUser();
  if (error) return error;
  void (await params).opportunityId; // require auth but no session read needed — client sends full article

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return err("OPENAI_API_KEY not configured", 503, "SERVICE_UNAVAILABLE");

  const body = await req.json() as {
    fixType: "thin_section" | "geo_check";
    // thin_section fields
    sectionHeading?: string;
    sectionType?: string;
    paragraphs?: GeneratedParagraph[];
    minWords?: number;
    // geo_check fields
    checkLabel?: string;
    // shared
    articleTitle: string;
    sections: GeneratedSection[];
  };

  const { fixType, articleTitle, sections } = body;

  if (fixType === "thin_section") {
    const { sectionHeading, sectionType = "section", paragraphs = [], minWords = 150 } = body;
    if (!sectionHeading) return err("sectionHeading required", 400);

    const promptFn = THIN_PROMPTS[sectionType] ?? THIN_PROMPTS["section"];
    const system = promptFn(minWords);
    const currentText = paragraphs.map(p => p.text).join("\n\n");
    const userPrompt = `Article title: ${articleTitle}\nSection heading: ${sectionHeading}\nSection type: ${sectionType}\n\nCurrent content:\n${currentText}\n\nExpand to at least ${minWords} words.`;

    try {
      const result = await chatJson<{ paragraphs: string[] }>(system, userPrompt, "gpt-4o-mini", { userId: user.id, feature: "fix-section" });
      const rawParagraphs: string[] = Array.isArray(result.paragraphs) ? result.paragraphs : [];

      // Merge: keep existing paragraphs if they're in the returned set, otherwise use returned
      const baseId = paragraphs.length > 0 ? Math.max(...paragraphs.map(p => p.id)) + 1 : 100;
      const merged: GeneratedParagraph[] = rawParagraphs.map((text, i) => ({
        id: paragraphs[i]?.id ?? baseId + i,
        text: typeof text === "string" ? text : "",
      })).filter(p => p.text);

      if (merged.length === 0) return err("LLM returned no content", 502);
      return ok({ sectionHeading, paragraphs: merged });
    } catch (e) {
      return err(e instanceof Error ? e.message : "LLM error", 502);
    }
  }

  if (fixType === "geo_check") {
    const { checkLabel } = body;
    if (!checkLabel) return err("checkLabel required", 400);

    const system = GEO_FIX_PROMPTS[checkLabel] ?? GEO_FIX_PROMPTS["Statistics with sources"];
    // Include enough paragraph text for the LLM to understand context and pick relevant sources.
    // Snippet-based checks don't need [id:N] — include it only for legacy ID-based checks.
    const usesSnippets = checkLabel === "Named sources" || checkLabel === "Statistics with sources";
    const articleSummary = sections.map(s =>
      `Section: "${s.heading}" (type: ${s.type})\nParagraphs:\n${s.content.paragraphs.map((p, i) =>
        usesSnippets
          ? `  ${i + 1}. ${p.text.slice(0, 500)}`
          : `  [id:${p.id}] ${p.text.slice(0, 300)}`
      ).join("\n")}`
    ).join("\n\n---\n\n");

    const userPrompt = `Article title: ${articleTitle}\n\n${articleSummary}`;

    try {
      const result = await chatJson<{
        sectionHeading?: string;
        paragraphId?: number;
        newText?: string;
        appendParagraphs?: string[];
        // snippet-based matching (Named sources, Statistics with sources)
        snippetFixes?: { snippet: string; newText: string }[];
      }>(system, userPrompt, "gpt-4o-mini", { userId: user.id, feature: "fix-geo-v2" });

      // AI-tell: "fixes" array with sectionHeading + paragraphId
      if (Array.isArray(result.fixes) && result.fixes.length > 0) {
        return ok({ multifix: result.fixes });
      }

      // Named sources / Statistics: snippet-based paragraph matching across all sections
      if (Array.isArray(result.snippetFixes) && result.snippetFixes.length > 0) {
        const multifix: { sectionHeading: string; paragraphId: number; newText: string }[] = [];
        for (const fix of result.snippetFixes) {
          if (!fix.snippet || !fix.newText) continue;
          const needle = fix.snippet.trim().toLowerCase().slice(0, 50);
          for (const s of sections) {
            const para = s.content.paragraphs.find(p =>
              p.text.trimStart().toLowerCase().slice(0, 50).startsWith(needle.slice(0, 40))
            );
            if (para) { multifix.push({ sectionHeading: s.heading, paragraphId: para.id, newText: fix.newText }); break; }
          }
        }
        if (multifix.length > 0) return ok({ multifix });
      }

      const headingMatch = (a: string, b: string) =>
        a.trim().toLowerCase() === b.trim().toLowerCase() ||
        a.trim().toLowerCase().includes(b.trim().toLowerCase()) ||
        b.trim().toLowerCase().includes(a.trim().toLowerCase());

      const targetHeading = result.sectionHeading ?? sections[0]?.heading ?? "";
      const targetSection = sections.find(s => headingMatch(s.heading, targetHeading)) ?? sections[0];

      if (result.appendParagraphs?.length) {
        // FAQ fan-out: append new paragraphs
        const baseId = targetSection.content.paragraphs.length > 0
          ? Math.max(...targetSection.content.paragraphs.map(p => p.id)) + 1 : 100;
        const newParas = result.appendParagraphs.map((text, i) => ({
          id: baseId + i,
          text: typeof text === "string" ? text : "",
        })).filter(p => p.text);
        return ok({
          sectionHeading: targetHeading,
          paragraphs: [...targetSection.content.paragraphs, ...newParas],
        });
      }

      if (result.paragraphId !== undefined && result.newText) {
        // Replace one paragraph in the target section
        const updated = targetSection.content.paragraphs.map(p =>
          p.id === result.paragraphId ? { ...p, text: result.newText! } : p
        );
        // If no paragraph matched the id, append instead
        const matched = updated.some(p => p.id === result.paragraphId);
        if (!matched) updated.push({ id: result.paragraphId, text: result.newText });
        return ok({ sectionHeading: targetHeading, paragraphs: updated });
      }

      return err("LLM response was missing required fields", 502);
    } catch (e) {
      return err(e instanceof Error ? e.message : "LLM error", 502);
    }
  }

  return err("Invalid fixType", 400);
}

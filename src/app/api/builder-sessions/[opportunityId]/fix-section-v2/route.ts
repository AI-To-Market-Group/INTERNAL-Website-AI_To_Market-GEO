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

const GEO_FIX_PROMPTS: Record<string, string> = {
  "Named sources": `You are a GEO content editor. The article needs more named source attributions.
Find the section and paragraph most naturally suited to add "according to [Source, Year]" attribution to an existing claim.
Pick one of: Gartner, McKinsey, Salesforce, LinkedIn, Forrester, IDC, HubSpot, Bain.
Keep the rest of the paragraph intact — only add the attribution phrase.
Respond with JSON only: { "sectionHeading": "<exact heading>", "paragraphId": <id>, "newText": "<full updated paragraph text>" }`,

  "Statistics with sources": `You are a GEO content editor. The article needs one more numeric statistic attributed to a named source.
Find the section where a stat would land most naturally.
Add a real, plausible B2B/AI/marketing statistic to the last paragraph of that section.
Named sources only: Gartner, Salesforce, McKinsey, Forrester, IDC, HubSpot. Format: "per Source (Year)".
Respond with JSON only: { "sectionHeading": "<exact heading>", "paragraphId": <id>, "newText": "<full updated paragraph text>" }`,

  "Cited claims": `You are a GEO content editor. Add one cited claim to the article.
Find the best paragraph to add "according to [Source], [claim]" or a brief quoted finding.
Keep surrounding prose intact.
Respond with JSON only: { "sectionHeading": "<exact heading>", "paragraphId": <id>, "newText": "<full updated paragraph text>" }`,

  "AI-tell density": `You are a GEO content editor removing AI-generated phrasing from the article.
Find the paragraph with the most AI-tell phrases (e.g. "thought leaders", "showcasing", "highlighting", "it is widely believed", "game-changing", "leveraging", "in today's landscape").
Rewrite that paragraph in direct, specific language — concrete claims, specific tools/companies, no vague qualifiers.
Respond with JSON only: { "sectionHeading": "<exact heading>", "paragraphId": <id>, "newText": "<full rewritten paragraph text>" }`,

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
    const articleSummary = sections.map(s =>
      `Heading: "${s.heading}" (type: ${s.type})\nParagraphs:\n${s.content.paragraphs.map(p => `  [id:${p.id}] ${p.text.slice(0, 300)}`).join("\n")}`
    ).join("\n\n---\n\n");

    const userPrompt = `Article title: ${articleTitle}\n\n${articleSummary}`;

    try {
      const result = await chatJson<{
        sectionHeading?: string;
        paragraphId?: number;
        newText?: string;
        appendParagraphs?: string[];
      }>(system, userPrompt, "gpt-4o-mini", { userId: user.id, feature: "fix-geo-v2" });

      const targetHeading = result.sectionHeading ?? sections[0]?.heading ?? "";
      const targetSection = sections.find(s => s.heading === targetHeading) ?? sections[0];

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

import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { getSession, updateSession } from "@/lib/builder-sessions-store";
import { computeGeoScore } from "@/lib/geo-score";
import type { ArticleDraft, ArticleDraftBlock } from "@/types";

type Params = { params: Promise<{ opportunityId: string }> };

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function blocksToPlainText(blocks: ArticleDraftBlock[]): string {
  return blocks.map((b) => stripHtml(b.content ?? "")).join(" ").replace(/\s+/g, " ").trim();
}

// Per-check GPT instructions
const FIX_PROMPTS: Record<string, string> = {
  "Statistics with sources": `You are a GEO content editor improving a B2B AI article's citation density.

TASK: The article needs one more numeric statistic attributed to a named source.
Find the paragraph most naturally suited to include a specific cited figure.
Add a real, plausible B2B / AI / marketing statistic to that paragraph.

RULES:
- Use credible sources: Gartner, Salesforce, McKinsey, LinkedIn, Forrester, IDC, HubSpot, Harvard Business Review
- Use specific, realistic numbers: "68%", "3.2x", "$4.2B", "40–60%"
- Attribution format: "per Source (Year)" or "per Source and Source (Year)"
- Do NOT change headings (type: "heading" blocks)
- Keep all other sentences intact — only insert the stat naturally into the chosen paragraph
- Return the FULL updated paragraph text (plain text, no HTML tags)

Respond with JSON only: { "blockIndex": <integer>, "newContent": "<full updated paragraph plain text>" }`,

  "Named sources": `You are a GEO content editor improving source attribution in a B2B AI article.

TASK: The article needs more named source attributions. Find 1 claim that references research or data without naming a specific organisation, and add "per Source (Year)" attribution.

RULES:
- Use: Gartner, Salesforce, McKinsey, LinkedIn, Forrester, IDC, HubSpot, Bain
- Attribution format: "per Source (Year)" at end of sentence
- Do NOT change headings
- Return the FULL updated paragraph plain text

Respond with JSON only: { "blockIndex": <integer>, "newContent": "<full updated paragraph plain text>" }`,

  "Cited claims": `You are a GEO content editor. Add a cited claim to the article.

TASK: Find the best paragraph to add an attributed inline citation or quoted finding.
Add "according to [Source], [claim]" or insert a brief quoted passage: "claim text" — Source, Year.

RULES:
- Keep surrounding prose intact
- Do NOT change headings
- Return the FULL updated paragraph plain text

Respond with JSON only: { "blockIndex": <integer>, "newContent": "<full updated paragraph plain text>" }`,

  "AI-tell density": `You are a GEO content editor removing AI-generated phrasing from a B2B article.

TASK: Find the paragraph containing AI-tell phrases (e.g. "thought leaders", "showcasing", "highlighting", "it is widely believed") and rewrite that paragraph in direct, specific language.

RULES:
- Replace vague AI phrases with concrete, specific statements
- Do NOT change headings
- Return the FULL rewritten paragraph plain text

Respond with JSON only: { "blockIndex": <integer>, "newContent": "<full updated paragraph plain text>" }`,

  "FAQ fan-out coverage": `You are a GEO content editor adding an FAQ section to a B2B AI article.

TASK: Generate 3 FAQ pairs covering likely reader follow-up questions based on the article content. These will be appended to the article.

FORMAT — return each Q/A pair as "Q: question\nA: answer" separated by blank lines.

Respond with JSON only: { "blockIndex": -1, "newContent": "Q: question1\nA: answer1\n\nQ: question2\nA: answer2\n\nQ: question3\nA: answer3" }`,
};

export async function POST(req: NextRequest, { params }: Params) {
  const { opportunityId } = await params;
  const { user, error } = await requireUser();
  if (error) return error;

  const session = await getSession(user.id, opportunityId);
  if (!session) return err("Session not found", 404, "NOT_FOUND");

  const draft = session.draft as ArticleDraft | null;
  if (!draft?.blocks?.length) return err("No draft to fix", 400, "BAD_REQUEST");

  const { checkLabel } = await req.json() as { checkLabel: string };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return err("OPENAI_API_KEY not configured", 503, "SERVICE_UNAVAILABLE");

  const systemPrompt = FIX_PROMPTS[checkLabel] ?? FIX_PROMPTS["Statistics with sources"];

  // Build a stripped-down block list for the LLM (plain text only, no HTML)
  const blocksForLlm = draft.blocks.map((b, i) => ({
    index: i,
    type: b.type,
    content: stripHtml(b.content ?? ""),
  }));

  const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `ARTICLE BLOCKS:\n${JSON.stringify(blocksForLlm, null, 2)}` },
      ],
      max_tokens: 600,
      temperature: 0.3,
    }),
  });

  if (!llmRes.ok) {
    const body = await llmRes.text();
    return err(`LLM error ${llmRes.status}: ${body}`, 502, "BAD_GATEWAY");
  }

  const llmData = await llmRes.json() as { choices: Array<{ message: { content: string } }> };
  let parsed: { blockIndex: number; newContent: string };
  try {
    parsed = JSON.parse(llmData.choices[0].message.content);
  } catch {
    return err("Failed to parse LLM response", 502, "BAD_GATEWAY");
  }

  const updatedBlocks = [...draft.blocks];

  if (parsed.blockIndex === -1) {
    // Append FAQ blocks
    const faqPairs = parsed.newContent.split(/\n\n+/).filter(Boolean);
    for (const pair of faqPairs) {
      updatedBlocks.push({
        id: `block-fix-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "paragraph",
        content: pair.trim(),
        meta: { sectionType: "faq" },
      });
    }
  } else if (parsed.blockIndex >= 0 && parsed.blockIndex < updatedBlocks.length) {
    const target = updatedBlocks[parsed.blockIndex];
    if (target.type !== "heading") {
      updatedBlocks[parsed.blockIndex] = { ...target, content: parsed.newContent };
    }
  }

  const updatedDraft: ArticleDraft = { ...draft, blocks: updatedBlocks };
  await updateSession(user.id, opportunityId, { article: updatedDraft });

  const geoScore = computeGeoScore(blocksToPlainText(updatedBlocks), draft.title ?? "");

  return ok({ draft: updatedDraft, geoScore });
}

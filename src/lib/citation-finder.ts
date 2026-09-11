/**
 * Finds a real, verifiable B2B citation via gpt-4o-search-preview,
 * then rewrites a paragraph to embed it in GEO scorer-recognised format.
 */
import { chatJson, type AiCallCtx } from "@/lib/openai-article";

export interface FoundCitation {
  source: string;   // e.g. "McKinsey & Company"
  year: string;     // e.g. "2024"
  url: string;      // actual URL
  finding: string;  // one-sentence finding
}

export async function searchForCitation(
  claim: string,
  apiKey: string
): Promise<FoundCitation | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-search-preview",
        web_search_options: {},
        messages: [
          {
            role: "user",
            content: `Search the web and find ONE real, verifiable statistic or finding from a credible B2B source that is directly relevant to this claim:

CLAIM: "${claim}"

Requirements:
- Must be from a real, published report or article (Gartner, Forrester, McKinsey, HubSpot, Salesforce, LinkedIn, IDC, Deloitte, PwC, Harvard Business Review, MIT Sloan, Bain, BCG, Accenture, or similar credible publisher)
- Must actually exist — do not invent statistics
- Must be from 2022 or later
- The finding must genuinely relate to the claim topic

Respond with ONLY this JSON object, nothing else:
{
  "source": "Exact publisher name",
  "year": "YYYY",
  "url": "https://actual-url-of-the-report-or-article",
  "finding": "The specific statistic or finding in one sentence, exactly as found"
}

If you cannot find a real, verifiable source, respond with: {"notFound": true}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<FoundCitation> & { notFound?: boolean };
    if (parsed.notFound || !parsed.source || !parsed.finding) return null;

    return {
      source: parsed.source,
      year: parsed.year ?? new Date().getFullYear().toString(),
      url: parsed.url ?? "",
      finding: parsed.finding,
    };
  } catch {
    return null;
  }
}

/**
 * Rewrites a paragraph to embed a real citation in GEO scorer-recognised format.
 * The source name is hyperlinked so readers can click through to verify.
 * The GEO scorer strips HTML before checking, so the plain-text attribution still registers.
 */
export async function rewriteWithCitation(
  paragraphText: string,
  citation: FoundCitation,
  ctx: AiCallCtx
): Promise<string | null> {
  const linkedSource = citation.url
    ? `<a href="${citation.url}" target="_blank" rel="noopener noreferrer">${citation.source} (${citation.year})</a>`
    : `${citation.source} (${citation.year})`;

  const system = `You are a GEO content editor. You have found a real, verified source for a claim in this paragraph. Rewrite the paragraph to naturally embed the citation using EXACTLY one of these formats:
  • "According to ${linkedSource}, [claim]."
  • "per ${linkedSource}, [claim]."
  • "[sentence] — ${linkedSource}"
The attribution text must appear verbatim — do not change the HTML or the source name. Keep all other sentences in the paragraph unchanged.
Respond with JSON only: { "newText": "<full rewritten paragraph with the HTML attribution embedded>" }`;

  const user = `PARAGRAPH TO REWRITE:\n${paragraphText}\n\nREAL SOURCE FOUND:\nPublisher: ${citation.source}\nYear: ${citation.year}\nFinding: ${citation.finding}\nURL: ${citation.url}`;

  try {
    const result = await chatJson<{ newText?: string }>(system, user, "gpt-4o-mini", ctx);
    return result.newText ?? null;
  } catch {
    return null;
  }
}

/**
 * Finds a real, verifiable B2B citation via the OpenAI Responses API's
 * `web_search` tool, then rewrites a paragraph to embed it in GEO
 * scorer-recognised format.
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
    // NOTE: this previously called `gpt-4o-search-preview` via the Chat
    // Completions API — that model has been deprecated and removed by OpenAI
    // (every call returns HTTP 404), which is why this feature silently never
    // found a citation. The current, verified replacement is the Responses
    // API's `web_search` tool on a standard model. `search_context_size:
    // "high"` plus explicitly asking the model to "cite it directly" is what
    // actually gets `annotations[].url_citation` populated with a real URL —
    // confirmed via a live test call before shipping this.
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search", search_context_size: "high" }],
        input: `Search the web for ONE real, verifiable statistic or finding from a credible B2B source (Gartner, Forrester, McKinsey, HubSpot, Salesforce, LinkedIn, IDC, Deloitte, PwC, Harvard Business Review, MIT Sloan, Bain, BCG, or Accenture) that is directly relevant to this claim, published in 2022 or later:

CLAIM: "${claim}"

Find a specific page and quote or closely paraphrase its finding, citing it directly so the source link is attached to your answer. Respond with exactly one sentence: "According to [Publisher Name] ([Year]), [the specific statistic or finding]." If you cannot find a real, verifiable source, respond with exactly: NOT_FOUND`,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json() as {
      output?: {
        type?: string;
        content?: {
          type?: string;
          text?: string;
          annotations?: { type?: string; url?: string; title?: string }[];
        }[];
      }[];
    };

    const message = data.output?.find((o) => o.type === "message");
    const part = message?.content?.find((c) => c.type === "output_text");
    const content = part?.text?.trim() ?? "";
    if (!content || /^NOT_FOUND/i.test(content)) return null;

    // The real, grounded URL lives only in the search tool's citation
    // annotations — never trust a URL the model might type into free text,
    // it is frequently wrong or fabricated. No annotation = no verifiable
    // source, so treat it as not found rather than emitting a fake citation.
    const url = part?.annotations?.find((a) => a.type === "url_citation" && a.url)?.url;
    if (!url) return null;

    // Parse "According to X (YYYY), finding." — degrade gracefully if the
    // model didn't follow the exact requested format. Also strip the
    // markdown-style "([title](url))" the model tends to append inline.
    const m = content.match(/according to\s+(.+?)\s*\((\d{4})\)\s*,?\s*(.*)$/i);
    const source = m?.[1]?.trim() || (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "a cited source"; } })();
    const year = m?.[2] ?? new Date().getFullYear().toString();
    const finding = (m?.[3] || content).replace(/\(\[.*?\]\(https?:\/\/[^)]+\)\)/g, "").trim();

    return { source, year, url, finding };
  } catch {
    return null;
  }
}

/**
 * Deterministically wraps a plain-text attribution ("HubSpot (2025)") in an
 * anchor tag pointing at the verified source URL.
 *
 * This is done in code rather than by asking the LLM to emit raw HTML: small
 * models regularly drop, escape or mangle an anchor tag when told to reproduce
 * it verbatim inside a JSON string, which silently loses the link.
 */
export function linkifyAttribution(text: string, citation: FoundCitation): string {
  if (!citation.url) return text;
  // Model went off-script and already added HTML — leave it alone.
  if (/<a\s+href=/i.test(text)) return text;

  const anchor = (label: string) =>
    `<a href="${citation.url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const src = esc(citation.source);
  const yr = esc(citation.year);

  // "Source (Year)" / "Source, Year" / "Source Year" — link the whole attribution.
  const withYear = new RegExp(`${src}\\s*(?:\\(\\s*${yr}\\s*\\)|,\\s*${yr}|\\s+${yr})`, "i");
  const mYear = text.match(withYear);
  if (mYear) return text.replace(withYear, anchor(mYear[0]));

  // Fall back to linking just the publisher name, first occurrence only.
  const nameOnly = new RegExp(src, "i");
  const mName = text.match(nameOnly);
  if (mName) return text.replace(nameOnly, anchor(mName[0]));

  return text;
}

/**
 * Rewrites a paragraph to embed a real citation in GEO scorer-recognised format,
 * then hyperlinks the source name so readers can click through to verify.
 * The GEO scorer strips HTML before checking, so the plain-text attribution still registers.
 */
export async function rewriteWithCitation(
  paragraphText: string,
  citation: FoundCitation,
  ctx: AiCallCtx
): Promise<string | null> {
  // Ask for a PLAIN-TEXT attribution — the anchor is added in code afterwards.
  const plainSource = `${citation.source} (${citation.year})`;

  const system = `You are a GEO content editor. You have found a real, verified source for a claim in this paragraph. Rewrite the paragraph to naturally embed the attribution "${plainSource}" using EXACTLY one of these formats:
  • "According to ${plainSource}, [claim]."
  • "per ${plainSource}, [claim]."
  • "[sentence] — ${plainSource}"
The attribution "${plainSource}" must appear verbatim, exactly once, as plain text. Do NOT add any HTML tags or markdown links. Keep all other sentences in the paragraph unchanged.
Respond with JSON only: { "newText": "<full rewritten paragraph>" }`;

  const user = `PARAGRAPH TO REWRITE:\n${paragraphText}\n\nREAL SOURCE FOUND:\nPublisher: ${citation.source}\nYear: ${citation.year}\nFinding: ${citation.finding}`;

  try {
    const result = await chatJson<{ newText?: string }>(system, user, "gpt-4o-mini", ctx);
    if (!result.newText) return null;
    return linkifyAttribution(result.newText, citation);
  } catch {
    return null;
  }
}

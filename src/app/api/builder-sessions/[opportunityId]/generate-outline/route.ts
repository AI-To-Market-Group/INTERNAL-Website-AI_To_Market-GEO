import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/builder-sessions-store";
import { chatJson } from "@/lib/openai-article";
import { requireUser } from "@/lib/api-auth";
import { getBrandVoicePrompt } from "@/lib/brand-voice";
import type {
  GenerateArticleSectionsResponse,
  GenerateArticleSection,
  OutlineWarning,
} from "@/types";

const REQUIRED_SECTION_TYPES = ["introduction", "faq", "stats", "conclusion"];

function validateOutline(sections: GenerateArticleSection[]): OutlineWarning[] {
  const warnings: OutlineWarning[] = [];
  const types = sections.map((s) => s.type);

  if (sections.length < 5 || sections.length > 7) {
    warnings.push({
      type: "wrong_section_count",
      message: `Outline has ${sections.length} sections (expected 5–7).`,
    });
  }

  for (const required of REQUIRED_SECTION_TYPES) {
    if (!types.includes(required)) {
      warnings.push({
        type: "missing_section_type",
        message: `Missing required section type: "${required}".`,
      });
    }
  }

  if (types[0] !== "introduction") {
    warnings.push({ type: "wrong_order", message: 'First section must be type "introduction".' });
  }
  if (types[types.length - 1] !== "faq") {
    warnings.push({ type: "wrong_order", message: 'Last section must be type "faq" (FAQ at the end maximises People Also Ask extraction).' });
  }

  return warnings;
}

// Auto-repair structural issues so the LLM's occasional non-compliance
// doesn't surface as user-visible warnings.
function enforceOutlineStructure(sections: GenerateArticleSection[], topic: string): GenerateArticleSection[] {
  let fixed = [...sections];

  // 1. Ensure introduction is first
  const introIdx = fixed.findIndex((s) => s.type === "introduction");
  if (introIdx === -1) {
    fixed.unshift({ order: 1, type: "introduction", title: "Introduction", description: ["What to cover: Context and business stakes.", "Angle: Lead with a real scenario or tension.", "Avoid: Generic 'AI is transforming X' openers."], keywords: [] });
  } else if (introIdx !== 0) {
    const [intro] = fixed.splice(introIdx, 1);
    fixed.unshift(intro);
  }

  // 2. Ensure a stats section exists (insert before conclusion)
  if (!fixed.some((s) => s.type === "stats")) {
    const conclusionIdx = fixed.findIndex((s) => s.type === "conclusion");
    const insertAt = conclusionIdx !== -1 ? conclusionIdx : fixed.length;
    fixed.splice(insertAt, 0, {
      order: insertAt + 1,
      type: "stats",
      title: `${topic} — Key Data Points`,
      description: ["What to cover: 3+ statistics with named sources.", "Angle: Data that challenges vendor claims or reveals adoption gaps.", "Avoid: Vague percentages without year or source."],
      keywords: [],
    });
  }

  // 3. Ensure conclusion exists (must be second-to-last)
  if (!fixed.some((s) => s.type === "conclusion")) {
    const faqIdx = fixed.findIndex((s) => s.type === "faq");
    const insertAt = faqIdx !== -1 ? faqIdx : fixed.length;
    fixed.splice(insertAt, 0, {
      order: insertAt + 1,
      type: "conclusion",
      title: "Key Takeaways",
      description: ["What to cover: 3–5 bulleted action points.", "Angle: What a practitioner should do next week.", "Avoid: Restating section headings verbatim."],
      keywords: [],
    });
  }

  // 4. Ensure faq is last
  const faqIdx = fixed.findIndex((s) => s.type === "faq");
  if (faqIdx === -1) {
    fixed.push({
      order: fixed.length + 1,
      type: "faq",
      title: "Frequently Asked Questions",
      description: [`Q: What is the most common mistake when adopting AI for ${topic}?`, "Q: How long does implementation typically take?", "Q: Which tools or vendors are most commonly used?"],
      keywords: [],
    });
  } else if (faqIdx !== fixed.length - 1) {
    const [faq] = fixed.splice(faqIdx, 1);
    fixed.push(faq);
  }

  // 5. Trim to max 7, keeping required types
  while (fixed.length > 7) {
    const removable = fixed.findIndex((s, i) => i !== 0 && i !== fixed.length - 1 && !["introduction","stats","conclusion","faq"].includes(s.type));
    if (removable === -1) break;
    fixed.splice(removable, 1);
  }

  // Re-number
  return fixed.map((s, i) => ({ ...s, order: i + 1 }));
}

type Params = { params: Promise<{ opportunityId: string }> };

function mockOutlineResponse(topicTitle: string): GenerateArticleSectionsResponse {
  return {
    article_title: topicTitle,
    sections: [
      { order: 1, type: "introduction", title: "Introduction", description: ["Context and stakes of the topic."], keywords: [] },
      { order: 2, type: "section", title: "Key points", description: ["Main ideas and benefits."], keywords: [] },
      { order: 3, type: "section", title: "Practical aspects", description: ["How to apply or implement."], keywords: [] },
      { order: 4, type: "conclusion", title: "Conclusion", description: ["Summary and call to action."], keywords: [] },
    ],
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;
  const body = (await req.json()) as {
    topic_title?: string;
    theme?: string;
    intents?: string[];
    content_brief?: string;
    justification_signals?: string[];
    tags?: string[];
  };
  const topicTitle = body.topic_title ?? "Article";

  let response: GenerateArticleSectionsResponse;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    response = mockOutlineResponse(topicTitle);
  } else {
    try {
      const system = `You are a GEO (Generative Engine Optimization) content strategist. Generate article outlines that AI search engines (ChatGPT, Perplexity, Claude, Gemini) will cite as authoritative sources.

${getBrandVoicePrompt()}

Return only valid JSON with this exact shape (no markdown, no code block):
{
  "article_title": "string (specific, benefit-driven, mentions a real product or scenario — NOT 'The Ultimate Guide to X')",
  "sections": [
    {
      "order": 1,
      "type": "introduction|section|comparison|how_to|faq|stats|conclusion",
      "title": "Section heading",
      "description": ["What to cover: ...", "Angle: ...", "Avoid: ..."],
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}

STRUCTURE RULES:
1. Section 1 is type "introduction". The TITLE must NOT be a generic "What is [Topic]" definition — instead, lead with a real scenario, an industry tension, or a counterintuitive angle (e.g. "Why AI Content Tools Miss the Citation Signal" or "The Real Reason B2B Blogs Fail AI Discovery"). Definition content can appear inside the introduction body if relevant, but the heading must be compelling.
2. Include exactly ONE section of type "stats" with 3+ data points — statistics are the #1 citation trigger for LLMs. Title it specifically (e.g. "AI Adoption in B2B Marketing by the Numbers"), not "Key Statistics".
3. Include exactly ONE section of type "conclusion" titled "Key Takeaways" with a bulleted summary.
4. The VERY LAST section MUST be type "faq" titled "Frequently Asked Questions" with 3–5 Q: format questions in description.
5. "conclusion" comes BEFORE "faq" (faq is always last).
6. Any how-to or process section MUST be type "how_to" — use numbered steps in description.
7. Include 5 to 7 sections total.
8. Each description array MUST have exactly 3 bullets: "What to cover: [specific content with real product names]", "Angle: [perspective]", "Avoid: [pitfalls]". No generic bullets like "explain benefits" — name the actual mechanism, brand, or stat.`;
      const contextLines: string[] = [`Topic: ${topicTitle}`];
      if (body.theme) contextLines.push(`Theme: ${body.theme}`);
      if (body.intents?.length) contextLines.push(`Intents: ${body.intents.join(", ")}`);
      if (body.content_brief) contextLines.push(`Why this topic now: ${body.content_brief}`);
      if (body.justification_signals?.length) contextLines.push(`Content gap signals: ${body.justification_signals.join("; ")}`);
      if (body.tags?.length) contextLines.push(`Target keywords: ${body.tags.join(", ")}`);
      const userPrompt = contextLines.join("\n");
      response = await chatJson<GenerateArticleSectionsResponse>(system, userPrompt, undefined, { userId: user.id, feature: "article-outline" });
      if (!response.sections?.length) {
        response = mockOutlineResponse(topicTitle);
      } else {
        response.article_title = response.article_title ?? topicTitle;
        response.sections = (response.sections as GenerateArticleSection[]).map((s, i) => ({
          order: s.order ?? i + 1,
          type: s.type ?? "section",
          title: s.title ?? `Section ${i + 1}`,
          description: Array.isArray(s.description) ? s.description : [],
          keywords: Array.isArray(s.keywords) ? s.keywords : [],
        }));
      }
    } catch {
      response = mockOutlineResponse(topicTitle);
    }
  }

  response.sections = enforceOutlineStructure(response.sections, topicTitle);
  const outlineWarnings = validateOutline(response.sections);

  try {
    await updateSession(user.id, opportunityId, {
      outline: response.sections.map((s, i) => ({
        id: `outline-${Date.now()}-${i}`,
        headingLevel: "H2" as const,
        type: s.type,
        title: s.title,
        content: s.description.map((d) => `• ${d}`).join("\n"),
        bullets: [],
        seo: { keywords: s.keywords ?? [] },
      })),
      currentStep: 1,
    });
  } catch (e) {
    // Non-fatal — return the outline to the client even if persistence fails
    console.error("[generate-outline] updateSession failed:", e);
  }

  return Response.json({ ...response, outline_warnings: outlineWarnings });
}

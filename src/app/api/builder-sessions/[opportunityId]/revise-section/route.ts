import type { NextRequest } from "next/server";
import { chatJson } from "@/lib/openai-article";
import type { GenerateArticleSection } from "@/types";
import { parseBody, ok, err } from "@/lib/api-response";
import { reviseSectionSchema } from "@/lib/api-schemas";
import { getBrandVoiceCompact } from "@/lib/brand-voice";

type Params = { params: Promise<{ opportunityId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  await params;

  const parsed = await parseBody(req, reviseSectionSchema);
  if (parsed.error) return parsed.error;

  const body = parsed.data;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return err("OPENAI_API_KEY not configured. Service unavailable.", 503, "SERVICE_UNAVAILABLE");
  }

  try {
    const system = `You are an editorial outline editor. Revise one article section based on the request.

${getBrandVoiceCompact()}

Return only valid JSON:
{ "order": number, "type": "section type", "title": "Revised heading", "description": ["bullet 1", "bullet 2", "bullet 3"], "keywords": ["kw1"] }

Description must have EXACTLY 3 bullets:
- "What to cover: [specific content with real product/brand names]"
- "Angle: [editorial perspective — not a generic claim]"
- "Avoid: [pitfalls, including over-claiming and consulting jargon]"

The title must be specific and benefit-driven, NOT a generic "What is X" definition.
The revised section must not contradict or repeat content from sibling sections.`;
    const siblingBlock = body.sibling_sections?.length
      ? `\nOther sections in this article (do not repeat or contradict):\n${body.sibling_sections.map((s) => `- ${s.title}: ${s.summary}`).join("\n")}`
      : "";
    const user = `Section: ${body.title}\nDescription: ${body.description.join("\n")}${body.change_request ? `\nChange request: ${body.change_request}` : ""}${siblingBlock}`;
    const revised = await chatJson<GenerateArticleSection>(system, user);
    return ok({
      order: revised.order ?? body.order,
      type: revised.type ?? "section",
      title: revised.title ?? body.title,
      description: Array.isArray(revised.description) ? revised.description : body.description,
      keywords: Array.isArray(revised.keywords) ? revised.keywords : [],
    });
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Failed to revise section",
      500
    );
  }
}

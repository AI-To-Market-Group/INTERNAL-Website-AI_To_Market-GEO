import type { NextRequest } from "next/server";
import { parseBody, ok, err } from "@/lib/api-response";
import { reviseSelectionSchema } from "@/lib/api-schemas";
import { getBrandVoiceCompact } from "@/lib/brand-voice";
import { detectViolations, correctViolations } from "@/lib/brand-voice-checker";

type Params = { params: Promise<{ opportunityId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  await params;

  const parsed = await parseBody(req, reviseSelectionSchema);
  if (parsed.error) return parsed.error;

  const body = parsed.data;
  const selectedText = body.selected_text;
  const changeRequest = body.change_request?.trim() ?? "";
  const language = (body.language?.trim() || "en").toLowerCase();
  const articleContext = body.article_context?.trim() ?? "";

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return err("OPENAI_API_KEY not configured. Service unavailable.", 503, "SERVICE_UNAVAILABLE");
  }

  try {
    const system =
      `You are an expert editorial editor. Rewrite ONLY the selected text following the user's instruction. Keep facts accurate and style consistent with the article context. ${await getBrandVoiceCompact()} Return only the revised text — no quotes, no markdown, no explanations.`;

    const user =
      `Language: ${language}\n` +
      `Instruction: ${changeRequest || "Improve clarity while preserving meaning."}\n\n` +
      `Selected text:\n${selectedText}\n\n` +
      (articleContext
        ? `Article context (for tone and consistency):\n${articleContext.slice(0, 6000)}`
        : "");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-nano",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return err(`OpenAI ${res.status}: ${text.slice(0, 300)}`, 500);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const rawRevised = data.choices?.[0]?.message?.content?.trim() || selectedText;

    const checks = detectViolations([rawRevised]);
    const hasViolations = checks.some((c) => c.violations.length > 0);
    let revised = rawRevised;
    if (hasViolations) {
      const corrections = await correctViolations([rawRevised], checks);
      revised = corrections[0]?.corrected ?? rawRevised;
    }

    return ok({ text: revised });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to revise selection";
    return err(message, 500);
  }
}


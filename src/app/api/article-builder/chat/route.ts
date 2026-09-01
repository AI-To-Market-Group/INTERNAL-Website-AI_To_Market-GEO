import type { NextRequest } from "next/server";
import { parseBody, ok, err } from "@/lib/api-response";
import { articleBuilderChatSchema } from "@/lib/api-schemas";

const MODEL = "gpt-5.4-nano";

/**
 * Chat endpoint for content generation in the article builder and insight editor.
 * Accepts a message + context (step, outline/draft summary) and returns an assistant reply.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return err("OPENAI_API_KEY not configured on the server.", 500);
  }

  const parsed = await parseBody(req, articleBuilderChatSchema);
  if (parsed.error) return parsed.error;

  const body = parsed.data;
  const message = body.message;

  const step = body.step ?? 1;
  const topicTitle = body.topicTitle ?? "Article";
  const outlineSummary = body.outlineSummary ?? "";
  const draftSummary = body.draftSummary ?? "";
  const outlineSections = body.outlineSections ?? [];
  const conversationHistory = body.conversationHistory ?? [];

  const stepContext =
    step === 1
      ? "The user is working on the article outline/plan. You can suggest sections, rephrase titles, or propose an instruction to regenerate a section."
      : step === 2
        ? "The user is working on the article draft. You can suggest rephrasing, additions, or an instruction to regenerate a paragraph or section."
        : "The user is on the WordPress publishing step.";

  const contextParts: string[] = [
    `Article topic/title: ${topicTitle}.`,
    stepContext,
  ];
  if (outlineSummary) contextParts.push(`Current outline summary:\n${outlineSummary}`);
  if (draftSummary) contextParts.push(`Current draft summary:\n${draftSummary}`);
  if (outlineSections.length > 0) {
    contextParts.push(
      `Outline sections (id to use if you suggest regenerate_section):\n${outlineSections.map((s) => `- id: "${s.id}", title: ${s.title}`).join("\n")}`
    );
  }

  const actionJsonInstruction =
    outlineSections.length > 0 || step === 2
      ? `

If you propose a concrete action (regenerate an outline section, or modify the selection in the draft), add at the very end of your reply exactly one line in this format (valid JSON, single line):
ACTION_JSON: {"type":"regenerate_section","sectionId":"<id>","instruction":"<text>"}
or for the draft:
ACTION_JSON: {"type":"revise_selection","instruction":"<text>"}
- regenerate_section: sectionId = one of the ids listed in the outline sections. instruction = regeneration instruction.
- revise_selection: no sectionId. instruction = instruction to modify the selection.`
      : "";

  const systemContent = `You are an editorial assistant for AI To Market, specialized in AI strategy, marketing automation, sales AI, and supply chain AI content. You help improve articles (outline and writing) with actionable suggestions.

Current context:
${contextParts.join("\n\n")}

Respond in a concise, actionable way. If the user asks for a change (e.g. "make the intro shorter", "add a section on ROI"), propose a clear instruction they could use to "Regenerate" a section or paragraph. You can also suggest section ideas or rephrasing.${actionJsonInstruction}`;

  const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
    { role: "system", content: systemContent },
    ...conversationHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_completion_tokens: 800,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return err(`OpenAI error ${resp.status}: ${text.slice(0, 500)}`, 500);
    }

    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const rawReply = data.choices?.[0]?.message?.content ?? "";
    let reply = rawReply;

    let suggestedAction: { type: "regenerate_section" | "revise_selection"; sectionId?: string; instruction?: string } | undefined;
    const actionMatch = reply.match(/\nACTION_JSON:\s*(\{[\s\S]*?\})\s*$/m);
    if (actionMatch) {
      const stripped = reply.replace(/\nACTION_JSON:\s*\{[\s\S]*?\}\s*$/m, "").trim();
      // Only apply the strip if it leaves actual content — otherwise keep original
      reply = stripped.length > 0 ? stripped : rawReply;
      try {
        const parsed = JSON.parse(actionMatch[1]) as { type?: string; sectionId?: string; instruction?: string };
        if (parsed.type === "regenerate_section" || parsed.type === "revise_selection") {
          const validIds = new Set(outlineSections.map((s) => s.id));
          if (parsed.type === "regenerate_section" && parsed.sectionId && validIds.has(parsed.sectionId)) {
            suggestedAction = {
              type: "regenerate_section",
              sectionId: parsed.sectionId,
              instruction: typeof parsed.instruction === "string" ? parsed.instruction.trim() : undefined,
            };
          } else if (parsed.type === "revise_selection") {
            suggestedAction = {
              type: "revise_selection",
              instruction: typeof parsed.instruction === "string" ? parsed.instruction.trim() : undefined,
            };
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    return ok({ reply: reply || "I couldn't generate a response. Please try again.", suggestedAction });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return err(errorMessage, 500);
  }
}

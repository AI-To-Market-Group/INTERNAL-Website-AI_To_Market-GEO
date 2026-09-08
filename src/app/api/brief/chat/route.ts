import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { checkBudget } from "@/lib/budget-guard";
import { chatJson } from "@/lib/openai-article";
import { getBrandVoiceCompact } from "@/lib/brand-voice";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface BriefFields {
  client?: string;
  prompt?: string;
  format?: string;
  voice?: string;
  predictedScore?: string;
}

interface BriefChatResponse {
  reply: string;
  brief: BriefFields;
  readyToGenerate: boolean;
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const budget = await checkBudget(user.id);
  if (!budget.allowed) {
    return err(
      `Monthly call limit reached (${budget.count} of ${budget.budget}). Update your limit in AI Usage.`,
      429,
      "BUDGET_EXCEEDED"
    );
  }

  const system = `You are a brief-building assistant inside a GEO content tool (Generative Engine Optimization). Your job is to gather just enough context, synthesize a clear brief, and move to generation quickly. You are decisive — you do not keep asking the same question.

Brand voice context: ${await getBrandVoiceCompact()}

CRITICAL RULE — HOW TO HANDLE USER AFFIRMATIONS:
If the user says "yes", "yes go ahead", "go ahead", "sure", "yep", "ok", "sounds good", or any similar confirmation, treat it as approval of whatever you most recently proposed. Do NOT ask the same question again. Move forward immediately — confirm what you are locking in and declare ready.

What you need (but do not need all three to proceed):
1. TOPIC/PROMPT — a rough topic is enough. You synthesize the exact target prompt yourself from what the user has said. Never ask the user to rephrase or give you a more exact version — that is your job.
2. CLIENT — ask once if not mentioned. If the user does not answer directly, proceed without it (leave blank).
3. FORMAT — pick one yourself based on the topic. Do not ask unless the user has a strong preference.

Decision rules:
- If the user gives you a topic (even vague like "demand forecasting"), synthesize a specific target prompt yourself, pick an appropriate format, and confirm both in one message. If they say yes or go ahead → set readyToGenerate to true immediately.
- If you still need the client name, ask it ONCE. After that, proceed whether you have it or not.
- Maximum 2 turns of back-and-forth before you declare ready. On turn 3, lock in what you have and go.
- Keep every reply to 2–3 sentences. Never repeat a question you have already asked.

Format selection guide (you decide, don't ask):
- Definitional/what-is topics → "Definitional explainer, 1,400 words"
- Comparison topics → "Comparison article, 1,200 words"
- How-to/instructional → "Instructional guide, 1,600 words"
- FAQ or common questions → "FAQ article, 1,000 words"
- Strategy/planning topics → "Strategic guide, 1,500 words"

GEO score prediction (only when readyToGenerate is true):
- High-specificity definitional → 78–86; comparison tables → 82–88; strategic/instructional → 75–82; vague → 60–72

When ready, end your reply with "Ready to generate." and set readyToGenerate to true.
Voice default is always "House style" unless the user specifies otherwise.

You MUST return valid JSON only — no markdown, no code fences. Exact shape:
{
  "reply": "your conversational reply here",
  "brief": {
    "client": "extracted client name, or empty string",
    "prompt": "the target prompt YOU synthesized from context, or empty string",
    "format": "the format YOU chose, or empty string",
    "voice": "any voice preference mentioned, or 'House style' once ready",
    "predictedScore": "XX of 100, or empty string until ready"
  },
  "readyToGenerate": false
}`;

  try {
    const body = (await req.json()) as { messages?: unknown };
    const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];

    if (messages.length === 0) {
      return err("messages array is required and must not be empty", 400);
    }

    const conversationText = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const userPrompt = `Conversation so far:\n\n${conversationText}\n\nRespond to the latest user message. Return JSON only.`;

    const result = await chatJson<BriefChatResponse>(system, userPrompt, undefined, {
      userId: user.id,
      feature: "brief-chat",
    });

    if (!result?.reply) {
      return err("AI returned an unexpected response format", 500);
    }

    return ok(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Brief chat failed", 500);
  }
}

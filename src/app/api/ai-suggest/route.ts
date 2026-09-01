import type { NextRequest } from "next/server";
import { parseBody, ok, err } from "@/lib/api-response";
import { aiSuggestSchema } from "@/lib/api-schemas";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return err("OPENAI_API_KEY not configured on the server.", 500);
  }

  const parsed = await parseBody(req, aiSuggestSchema);
  if (parsed.error) return parsed.error;

  const { selection, prompt } = parsed.data;

  const instruction =
    prompt && prompt.trim()
      ? prompt.trim()
      : "Rewrite this passage in a clearer, more professional style.";

  try {
  const body = {
    model: "gpt-5.4-nano",
    messages: [
      {
        role: "system",
        content:
          "You are an assistant that helps rewrite B2B marketing content. Do not change the business meaning, only the wording.",
      },
      {
        role: "user",
        content: `Original text:\n\n${selection}\n\nInstruction:\n${instruction}`,
      },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return err(`OpenAI error ${resp.status}: ${text.slice(0, 500)}`, 500);
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const suggestion = data.choices?.[0]?.message?.content ?? "";

  return ok({ suggestion });
  } catch (e) {
    return err(e instanceof Error ? e.message : "AI suggest failed", 500);
  }
}


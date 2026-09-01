import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { ok, err, parseBody } from "@/lib/api-response";
import { addOpportunityForUser } from "@/lib/opportunities/db";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { z } from "zod";
import type { Opportunity } from "@/types";

const MODEL = "gpt-5.4-nano";

const schema = z.object({
  name: z.string().min(1),
  date_start: z.string().min(1),
  date_end: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  description: z.string().optional(),
  count: z.number().min(1).max(6).default(4),
});

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured.");

  const resp = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an editorial content strategist for AI To Market — an AI strategy and implementation consultancy focused on marketing, sales, and supply chain AI adoption. " +
            "Generate content opportunity ideas for a seasonal or business event relevant to enterprise AI adoption. " +
            "Return valid JSON only. No extra text.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${t.slice(0, 300)}`);
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "{}";
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T12:00:00");
  // Find next annual occurrence if date has passed
  if (target < now) {
    target.setFullYear(now.getFullYear() + 1);
  }
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const { name, date_start, date_end, keywords, description, count } = parsed.data;

  const kwStr = keywords.length > 0 ? keywords.join(", ") : "AI marketing automation, AI for sales teams, generative AI for business";
  const descStr = description ? `\nBrand interest: ${description}` : "";
  const dateRange = date_end && date_end !== date_start
    ? `${date_start} to ${date_end}`
    : date_start;

  const prompt = `Generate exactly ${count} content opportunity ideas for the seasonal event "${name}" (${dateRange}).
Keywords to cover: ${kwStr}.${descStr}

For each opportunity return:
- title: compelling SEO article title (specific, not generic)
- content_brief: one sentence explaining the urgency for this date
- intents: array of 1-2 content intents from: ["education","comparison","lifestyle","awareness","purchase"]
- score: integer 45-80 (estimated impact score)

Return JSON: { "opportunities": [ { "title": "...", "content_brief": "...", "intents": [...], "score": ... } ] }`;

  let rawJson: string;
  try {
    rawJson = await callOpenAI(prompt);
  } catch (e) {
    return err(`AI generation failed: ${e instanceof Error ? e.message : "Unknown error"}`, 500);
  }

  let parsed2: { opportunities?: { title: string; content_brief: string; intents: string[]; score: number }[] };
  try {
    parsed2 = JSON.parse(rawJson) as typeof parsed2;
  } catch {
    return err("AI returned invalid JSON", 500);
  }

  const items = parsed2.opportunities ?? [];
  if (items.length === 0) return err("AI returned no opportunities", 500);

  const days = daysUntil(date_start);
  const dateKey = `${name}_${date_start}`;

  const created: Opportunity[] = [];

  for (const item of items.slice(0, count)) {
    const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const opp: Opportunity = {
      id,
      title: item.title,
      type: "SEASONAL",
      sources: ["date"],
      score: Math.min(100, Math.max(0, item.score ?? 55)),
      impact_score: item.score ?? 55,
      priority: days <= 30 ? "haute" : days <= 90 ? "moyenne" : "basse",
      theme: "AI in Marketing",
      intents: item.intents ?? ["awareness"],
      content_brief: item.content_brief ?? `Key date: ${name}`,
      active_season: name,
      date_event_key: dateKey,
      metrics: {
        search_volume: null,
        keyword_difficulty: null,
        current_position: null,
        target_position: null,
        trend_percentage: null,
        last_updated_days: null,
        days_until_event: days,
        event_name: name,
        category: "Seasonal",
        confidence: "good",
      },
    };
    await addOpportunityForUser(user.id, opp);
    created.push(opp);
  }

  return ok({ created, count: created.length });
}

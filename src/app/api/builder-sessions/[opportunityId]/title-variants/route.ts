import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-auth";

type Params = { params: Promise<{ opportunityId: string }> };

export async function POST(req: NextRequest, { params: _params }: Params) {
  const { error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as { title?: string; intro?: string };
  const title = (body.title ?? "").trim();
  if (!title) return Response.json({ variants: [] }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ variants: [title] });

  const intro = (body.intro ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);

  const system = `You are a B2B content strategist writing headlines for AI To Market, a B2B AI content agency.

Given an article title and brief intro, write 2 ALTERNATIVE title variations. Keep the original strong point but explore different angles:
- Different emotional hook (curiosity vs. authority vs. urgency)
- Different length (one shorter punchy, one fuller)
- Different framing (question, bold claim, how-to, result-first)

Rules:
- Each title max 80 chars
- No clickbait; keep it credible and specific
- B2B professional tone
- Do NOT repeat the original title

Return JSON only: { "variants": ["title2", "title3"] }`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `ORIGINAL TITLE: ${title}\n\nINTRO: ${intro}` },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!res.ok) return Response.json({ variants: [title] });
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0].message.content) as { variants?: unknown[] };
    const alts = (Array.isArray(parsed.variants) ? parsed.variants : [])
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .slice(0, 2)
      .map(v => v.trim().slice(0, 80));

    return Response.json({ variants: [title, ...alts] });
  } catch {
    return Response.json({ variants: [title] });
  }
}

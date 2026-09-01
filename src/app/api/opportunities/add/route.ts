import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { ok, parseBody } from "@/lib/api-response";
import { addOpportunityForUser } from "@/lib/opportunities/db";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1),
  type: z.enum(["SEASONAL", "TREND", "SEO_GAP"]).default("SEASONAL"),
  active_season: z.string().optional(),
  date_event_key: z.string().optional(),
  score: z.number().min(0).max(100).default(50),
  theme: z.string().optional(),
  content_brief: z.string().optional(),
  days_until_event: z.number().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const d = parsed.data;
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const sourceMap = {
    SEASONAL: "date",
    TREND: "trend",
    SEO_GAP: "gap",
  } as const;

  const opportunity = {
    id,
    title: d.title,
    type: d.type,
    sources: [sourceMap[d.type]] as ("date" | "trend" | "gap")[],
    score: d.score,
    impact_score: d.score,
    priority: "moyenne" as const,
    theme: d.theme ?? "AI & Computer Vision",
    intents: [],
    tags: d.tags ?? [],
    content_brief: d.content_brief ?? "",
    active_season: d.active_season ?? null,
    date_event_key: d.date_event_key ?? `${d.active_season ?? "custom"}_custom`,
    metrics: {
      search_volume: null,
      keyword_difficulty: null,
      current_position: null,
      target_position: null,
      trend_percentage: null,
      last_updated_days: null,
      days_until_event: d.days_until_event ?? null,
      event_name: d.active_season ?? null,
      category: "Custom",
      confidence: "medium" as const,
    },
  };

  await addOpportunityForUser(user.id, opportunity);

  return ok({ id, opportunity });
}

import { supabaseAdmin } from "@/lib/supabase/admin";

interface UsageRow {
  feature: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_usd: number;
  created_at: string;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedUsd: number;
  totalCalls: number;
  byFeature: { feature: string; calls: number; estimatedUsd: number; tokens: number }[];
  byDay: { date: string; estimatedUsd: number; calls: number }[];
}

const EMPTY: UsageSummary = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalEstimatedUsd: 0,
  totalCalls: 0,
  byFeature: [],
  byDay: [],
};

export async function dbGetUsageSummary(userId: string, days = 30): Promise<UsageSummary & { setupRequired?: boolean }> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from("ai_usage_log")
    .select("feature, model, input_tokens, output_tokens, estimated_usd, created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    const pgError = error as { message?: string; code?: string };
    const msg = pgError.message ?? "";
    const code = pgError.code ?? "";
    // Surface the real error so the API route can log and return it
    throw new Error(`[Supabase ${code}] ${msg || JSON.stringify(error)}`);
  }

  const rows = (data ?? []) as UsageRow[];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalEstimatedUsd = 0;
  const featureMap = new Map<string, { calls: number; estimatedUsd: number; tokens: number }>();
  const dayMap = new Map<string, { estimatedUsd: number; calls: number }>();

  for (const row of rows) {
    const input = row.input_tokens ?? 0;
    const output = row.output_tokens ?? 0;
    const usd = Number(row.estimated_usd ?? 0);

    totalInputTokens += input;
    totalOutputTokens += output;
    totalEstimatedUsd += usd;

    const feat = row.feature ?? "unknown";
    const prev = featureMap.get(feat) ?? { calls: 0, estimatedUsd: 0, tokens: 0 };
    featureMap.set(feat, {
      calls: prev.calls + 1,
      estimatedUsd: prev.estimatedUsd + usd,
      tokens: prev.tokens + input + output,
    });

    const day = (row.created_at as string).slice(0, 10);
    const prevDay = dayMap.get(day) ?? { estimatedUsd: 0, calls: 0 };
    dayMap.set(day, { estimatedUsd: prevDay.estimatedUsd + usd, calls: prevDay.calls + 1 });
  }

  return {
    totalInputTokens,
    totalOutputTokens,
    totalEstimatedUsd,
    totalCalls: rows.length,
    byFeature: Array.from(featureMap.entries())
      .map(([feature, v]) => ({ feature, ...v }))
      .sort((a, b) => b.estimatedUsd - a.estimatedUsd),
    byDay: Array.from(dayMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

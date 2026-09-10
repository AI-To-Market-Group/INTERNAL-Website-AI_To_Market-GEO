/**
 * GEO benchmark run history — backed by Supabase.
 * User-scoped: all operations require a userId.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { GeoPromptResult, GeoLLMId } from "@/types";

export interface GeoRunRecord {
  runId: string;
  companyName?: string;
  mainUrl?: string;
  prompts: string[];
  results: GeoPromptResult[];
  model?: string;
  targetLLMs?: GeoLLMId[];
  avgCitationRate: number;
  totalEstimatedCostUsd?: number;
  totalLatencyMs?: number;
  createdAt?: string;
}

type DbRow = {
  run_id: string;
  company_name: string | null;
  main_url: string | null;
  prompts: unknown;
  results: unknown;
  model: string | null;
  target_llms: string[] | null;
  avg_citation_rate: string | null;
  total_estimated_cost_usd: string | null;
  total_latency_ms: number | null;
  created_at: string;
};

function rowToRecord(row: DbRow): GeoRunRecord {
  return {
    runId: row.run_id,
    companyName: row.company_name ?? undefined,
    mainUrl: row.main_url ?? undefined,
    prompts: (row.prompts as string[]) ?? [],
    results: (row.results as GeoPromptResult[]) ?? [],
    model: row.model ?? undefined,
    targetLLMs: (row.target_llms as GeoLLMId[] | null) ?? undefined,
    avgCitationRate: row.avg_citation_rate ? parseFloat(row.avg_citation_rate) : 0,
    totalEstimatedCostUsd: row.total_estimated_cost_usd
      ? parseFloat(row.total_estimated_cost_usd)
      : undefined,
    totalLatencyMs: row.total_latency_ms ?? undefined,
    createdAt: row.created_at,
  };
}

export async function dbSaveGeoRun(
  userId: string,
  run: GeoRunRecord
): Promise<void> {
  const { error } = await supabaseAdmin.from("geo_history").upsert(
    {
      user_id: userId,
      run_id: run.runId,
      company_name: run.companyName ?? null,
      main_url: run.mainUrl ?? null,
      prompts: run.prompts,
      results: run.results,
      model: run.model ?? null,
      target_llms: run.targetLLMs ?? null,
      avg_citation_rate: run.avgCitationRate,
      total_estimated_cost_usd: run.totalEstimatedCostUsd ?? null,
      total_latency_ms: run.totalLatencyMs ?? null,
      created_at: run.createdAt ?? new Date().toISOString(),
    },
    { onConflict: "user_id,run_id" }
  );
  if (error) throw error;
}

export async function dbGetGeoRunHistory(
  _userId: string,
  companyName?: string,
  limit = 20
): Promise<GeoRunRecord[]> {
  const safeLimit = Math.min(100, Math.max(1, limit));

  // Org-wide: fetch all runs regardless of who ran them
  let query = supabaseAdmin
    .from("geo_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (companyName) {
    query = query.eq("company_name", companyName);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as DbRow[]).map(rowToRecord);
}

export async function dbGetGeoRunById(
  _userId: string,
  runId: string
): Promise<GeoRunRecord | null> {
  // Org-wide: fetch by run_id only, regardless of who ran it
  const { data, error } = await supabaseAdmin
    .from("geo_history")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToRecord(data as DbRow);
}

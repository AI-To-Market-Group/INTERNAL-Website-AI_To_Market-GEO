/**
 * DB layer for opportunities — backed by Supabase.
 * User-scoped: every read/write requires userId.
 * On first load (empty table) the caller should seed from mock data.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Opportunity } from "@/types";

type DbRow = {
  id: string;
  user_id: string;
  title: string;
  type: string;
  data: Record<string, unknown>;
  created_at: string;
};

function rowToOpportunity(row: DbRow): Opportunity {
  return {
    ...(row.data as Omit<Opportunity, "id" | "title" | "type">),
    id: row.id,
    title: row.title,
    type: row.type as Opportunity["type"],
  };
}

export async function getOpportunitiesForUser(userId: string): Promise<Opportunity[]> {
  const { data, error } = await supabaseAdmin
    .from("opportunities")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as DbRow[]).map(rowToOpportunity);
}

export async function seedOpportunitiesForUser(
  userId: string,
  opportunities: Opportunity[]
): Promise<void> {
  const rows = opportunities.map((opp) => ({
    id: opp.id,
    user_id: userId,
    title: opp.title,
    type: opp.type ?? "SEO_GAP",
    data: opp,
  }));

  const { error } = await supabaseAdmin
    .from("opportunities")
    .upsert(rows, { onConflict: "user_id,id", ignoreDuplicates: true });

  if (error) throw error;
}

export async function addOpportunityForUser(
  userId: string,
  opportunity: Opportunity
): Promise<void> {
  const { error } = await supabaseAdmin.from("opportunities").insert({
    id: opportunity.id,
    user_id: userId,
    title: opportunity.title,
    type: opportunity.type ?? "SEASONAL",
    data: opportunity,
  });

  if (error) throw error;
}

export async function deleteOpportunityForUser(
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("opportunities")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  return !error;
}

/** Delete all opportunities linked to a specific event key (e.g. "Christmas_2026-12-25"). */
export async function deleteOpportunitiesByEventKey(
  userId: string,
  dateEventKey: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("opportunities")
    .delete()
    .eq("user_id", userId)
    .eq("data->>date_event_key", dateEventKey);

  if (error) throw error;
}

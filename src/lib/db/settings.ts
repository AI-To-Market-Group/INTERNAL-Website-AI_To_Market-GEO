/**
 * Supabase persistence for user settings (keywords, seasonal dates).
 * User-scoped: every operation requires a userId.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BigDate } from "@/types";

export async function dbGetKeywords(
  userId: string
): Promise<{ seed_keywords: string[] } | null> {
  const { data, error } = await supabaseAdmin
    .from("user_settings")
    .select("seed_keywords")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const arr = Array.isArray(data.seed_keywords) ? (data.seed_keywords as string[]) : [];
  return { seed_keywords: arr };
}

export async function dbSetKeywords(
  userId: string,
  keywords: string[]
): Promise<{ seed_keywords: string[] }> {
  const { error } = await supabaseAdmin
    .from("user_settings")
    .upsert(
      { user_id: userId, seed_keywords: keywords, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) throw error;
  return { seed_keywords: keywords };
}

export async function dbGetDates(
  userId: string
): Promise<{ big_dates: BigDate[] } | null> {
  const { data, error } = await supabaseAdmin
    .from("user_settings")
    .select("seasonal_dates")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const arr = Array.isArray(data.seasonal_dates) ? (data.seasonal_dates as BigDate[]) : [];
  return { big_dates: arr };
}

export async function dbSetDates(
  userId: string,
  dates: BigDate[]
): Promise<{ big_dates: BigDate[] }> {
  const { error } = await supabaseAdmin
    .from("user_settings")
    .upsert(
      { user_id: userId, seasonal_dates: dates, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) throw error;
  return { big_dates: dates };
}

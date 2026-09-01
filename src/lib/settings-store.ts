/**
 * Settings store — backed by Supabase, user-scoped.
 * Falls back to mock defaults if userId is unavailable (shouldn't happen in prod).
 */

import type { BigDate } from "@/types";
import { getMockSettings } from "./mock-dashboard-data";
import { dbGetKeywords, dbSetKeywords, dbGetDates, dbSetDates } from "@/lib/db";

export async function getKeywords(
  userId: string
): Promise<{ seed_keywords: string[] }> {
  try {
    const db = await dbGetKeywords(userId);
    if (db) return db;
  } catch {
    /* fall through to defaults */
  }
  return { seed_keywords: getMockSettings().seed_keywords };
}

export async function patchKeywords(
  userId: string,
  keywords: string[]
): Promise<{ seed_keywords: string[] }> {
  return dbSetKeywords(userId, keywords);
}

export async function getDates(
  userId: string
): Promise<{ big_dates: BigDate[] }> {
  try {
    const db = await dbGetDates(userId);
    if (db) return db;
  } catch {
    /* fall through to defaults */
  }
  return { big_dates: getMockSettings().big_dates };
}

export async function patchDates(
  userId: string,
  dates: BigDate[]
): Promise<{ big_dates: BigDate[] }> {
  return dbSetDates(userId, dates);
}

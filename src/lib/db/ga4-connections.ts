/**
 * Supabase persistence for GA4 OAuth connections.
 * User-scoped: every operation uses the authenticated user's ID.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface GA4ConnectionRow {
  user_id: string;
  ga_property_id: string;
  ga_property_display_name: string | null;
  access_token: string;
  refresh_token: string;
  token_expiry: number;
  created_at: number;
  updated_at: number;
}

export async function dbGetGAConnection(
  userId: string
): Promise<GA4ConnectionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("ga4_connections")
    .select(
      "user_id, ga_property_id, ga_property_display_name, access_token, refresh_token, token_expiry, created_at, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    user_id: data.user_id,
    ga_property_id: data.ga_property_id,
    ga_property_display_name: data.ga_property_display_name,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expiry: Number(data.token_expiry),
    created_at: Number(data.created_at),
    updated_at: Number(data.updated_at),
  };
}

export async function dbSaveGAConnection(input: {
  userId: string;
  gaPropertyId: string;
  gaPropertyDisplayName?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}): Promise<void> {
  const now = Date.now();

  const existing = await dbGetGAConnection(input.userId);

  const { error } = await supabaseAdmin.from("ga4_connections").upsert(
    {
      user_id: input.userId,
      ga_property_id: input.gaPropertyId,
      ga_property_display_name: input.gaPropertyDisplayName ?? null,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      token_expiry: input.tokenExpiry,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

export async function dbUpdateAccessToken(
  userId: string,
  accessToken: string,
  tokenExpiry: number
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ga4_connections")
    .update({
      access_token: accessToken,
      token_expiry: tokenExpiry,
      updated_at: Date.now(),
    })
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * Supabase persistence for Google Search Console OAuth connections.
 * User-scoped: every operation uses the authenticated user's ID.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface GSCConnectionRow {
  user_id: string;
  site_url: string;
  access_token: string;
  refresh_token: string;
  token_expiry: number;
  created_at: number;
  updated_at: number;
}

export async function dbGetGSCConnection(
  userId: string
): Promise<GSCConnectionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("gsc_connections")
    .select("user_id, site_url, access_token, refresh_token, token_expiry, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    user_id: data.user_id,
    site_url: data.site_url,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expiry: Number(data.token_expiry),
    created_at: Number(data.created_at),
    updated_at: Number(data.updated_at),
  };
}

export async function dbSaveGSCConnection(input: {
  userId: string;
  siteUrl: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}): Promise<void> {
  const now = Date.now();
  const existing = await dbGetGSCConnection(input.userId);

  const { error } = await supabaseAdmin.from("gsc_connections").upsert(
    {
      user_id: input.userId,
      site_url: input.siteUrl,
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

export async function dbUpdateGSCAccessToken(
  userId: string,
  accessToken: string,
  tokenExpiry: number
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("gsc_connections")
    .update({ access_token: accessToken, token_expiry: tokenExpiry, updated_at: Date.now() })
    .eq("user_id", userId);

  if (error) throw error;
}

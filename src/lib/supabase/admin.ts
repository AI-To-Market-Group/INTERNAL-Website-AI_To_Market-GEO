/**
 * Supabase admin client — uses service_role key, bypasses RLS.
 * SERVER-ONLY. Never import this in client components or expose to the browser.
 *
 * The client is created lazily (on first use) so the module can be imported
 * safely at build time even when env vars are not yet set.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
      );
    }
    _admin = createClient(url, key);
  }
  return _admin;
}

/**
 * Convenience proxy — use `supabaseAdmin.from(...)` just like before.
 * Delegates every property access to the lazily-created client.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") return value.bind(client);
    return value;
  },
});

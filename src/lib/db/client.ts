/**
 * Legacy shim — kept so old imports don't break during migration.
 * All DB operations now go through @/lib/supabase/* clients.
 */

export function getPool() {
  return null;
}

export function isDbAvailable(): boolean {
  return !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY
  );
}

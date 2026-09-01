/**
 * Helper for API routes: get the authenticated Supabase user.
 * Returns the user or null if not authenticated.
 * Use requireUser() when the route must be protected.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns `{ user }` or `{ error }` (a 401 Response). */
export async function requireUser(): Promise<
  | { user: { id: string; email?: string }; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }
  return { user: { id: user.id, email: user.email }, error: null };
}

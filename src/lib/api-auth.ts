/**
 * Helper for API routes: get the authenticated Supabase user.
 * Returns the user or null if not authenticated.
 * Use requireUser() when the route must be protected.
 */

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

/** Returns the role of the authenticated user, or null if not in team_members. */
export async function getUserRole(userId: string): Promise<"admin" | "editor" | null> {
  const { data } = await supabaseAdmin
    .from("team_members")
    .select("role")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return data.role as "admin" | "editor";
}

/** Returns `{ user }` or `{ error }` (401/403). Requires admin role. */
export async function requireAdmin(): Promise<
  | { user: { id: string; email?: string }; error: null }
  | { user: null; error: NextResponse }
> {
  const { user, error } = await requireUser();
  if (error) return { user: null, error };
  const role = await getUserRole(user.id);
  if (role !== "admin") {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Forbidden — admin access required", code: "FORBIDDEN" },
        { status: 403 }
      ),
    };
  }
  return { user, error: null };
}

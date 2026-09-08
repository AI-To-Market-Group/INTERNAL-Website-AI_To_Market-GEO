import { NextResponse } from "next/server";
import { requireUser, getUserRole } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const { data } = await supabaseAdmin
    .from("team_members")
    .select("id, email, full_name, role, created_at")
    .eq("id", user.id)
    .single();

  if (!data) {
    // User exists in auth but not yet in team_members — treat as editor
    return NextResponse.json({ id: user.id, email: user.email, role: "editor" });
  }

  return NextResponse.json(data);
}

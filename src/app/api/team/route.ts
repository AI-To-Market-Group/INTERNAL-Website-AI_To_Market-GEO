import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/team — list all team members (any authenticated user can view) */
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const { data, error: dbError } = await supabaseAdmin
    .from("team_members")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: true });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/team — invite a new member by email (admin only) */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { email, role = "editor", full_name } = (await req.json()) as {
    email?: string;
    role?: string;
    full_name?: string;
  };

  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });
  if (!["admin", "editor"].includes(role)) {
    return NextResponse.json({ error: "role must be admin or editor" }, { status: 400 });
  }

  // Send Supabase magic-link invite
  const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name ?? "" },
  });

  if (inviteErr) {
    return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  }

  // Upsert into team_members
  const { data: member, error: upsertErr } = await supabaseAdmin
    .from("team_members")
    .upsert({
      id: invited.user.id,
      email,
      full_name: full_name ?? null,
      role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  return NextResponse.json(member, { status: 201 });
}

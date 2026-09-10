import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/team — list all auth users merged with their team_members role */
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  // All users who have ever signed in
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  // Explicit role assignments
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, role, full_name, created_at");

  const roleMap = new Map((members ?? []).map(m => [m.id, m]));

  const merged = authData.users.map(u => {
    const tm = roleMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      full_name: tm?.full_name ?? (u.user_metadata?.full_name as string | undefined) ?? null,
      role: (tm?.role ?? "editor") as "admin" | "editor",
      created_at: u.created_at,
      invited: !u.last_sign_in_at, // true = invite sent but never logged in
    };
  });

  // Sort: admins first, then by created_at
  merged.sort((a, b) => {
    if (a.role === b.role) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return a.role === "admin" ? -1 : 1;
  });

  return NextResponse.json(merged);
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

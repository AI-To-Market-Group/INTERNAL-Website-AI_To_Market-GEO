import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/log-activity";

/** PATCH /api/team/[userId] — change role (admin only) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { userId } = await params;
  const { role } = (await req.json()) as { role?: string };

  if (!role || !["admin", "editor"].includes(role)) {
    return NextResponse.json({ error: "role must be admin or editor" }, { status: 400 });
  }

  // Prevent self-demotion
  if (userId === user.id && role === "editor") {
    return NextResponse.json({ error: "You cannot demote yourself" }, { status: 400 });
  }

  // Look up the user's email from auth so we can upsert if they're not in team_members yet
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email ?? "";

  const { data, error: dbErr } = await supabaseAdmin
    .from("team_members")
    .upsert({ id: userId, email, role }, { onConflict: "id" })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  void logActivity({ userId: user.id, userEmail: user.email ?? "", action: "team.role_change", entityType: "team_member", entityId: userId, entityTitle: email, metadata: { newRole: role } });
  return NextResponse.json(data);
}

/** DELETE /api/team/[userId] — remove a member (admin only, cannot remove self) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { userId } = await params;

  if (userId === user.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const { error: dbErr } = await supabaseAdmin
    .from("team_members")
    .delete()
    .eq("id", userId);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  void logActivity({ userId: user.id, userEmail: user.email ?? "", action: "team.remove", entityType: "team_member", entityId: userId });
  return new NextResponse(null, { status: 204 });
}

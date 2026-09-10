import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** GET /api/activity — list events (admin only), optional ?userId=&limit= */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

  let query = supabaseAdmin
    .from("activity_logs")
    .select("id, user_id, user_email, action, entity_type, entity_id, entity_title, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) query = query.eq("user_id", userId);

  const { data, error: dbErr } = await query;
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/activity — log an event (any authenticated user, logs their own action) */
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    entityType?: string;
    entityId?: string;
    entityTitle?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.action) return NextResponse.json({ error: "action required" }, { status: 400 });

  const { error: dbErr } = await supabaseAdmin.from("activity_logs").insert({
    user_id: user.id,
    user_email: user.email ?? "",
    action: body.action,
    entity_type: body.entityType ?? null,
    entity_id: body.entityId ?? null,
    entity_title: body.entityTitle ?? null,
    metadata: body.metadata ?? null,
  });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

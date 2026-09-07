import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const STALE_MS = 60_000; // 60 s without a heartbeat = gone

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const since = new Date(Date.now() - STALE_MS).toISOString();

  const { data, error: dbErr } = await supabaseAdmin
    .from("user_presence")
    .select("user_id, user_email, active_card_id, last_seen_at")
    .gte("last_seen_at", since);

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 });

  // Exclude the calling user from the response — they already know where they are
  const others = (data ?? []).filter((r: { user_id: string }) => r.user_id !== user.id);
  return Response.json(others);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as { cardId?: string | null };

  const { error: dbErr } = await supabaseAdmin
    .from("user_presence")
    .upsert(
      {
        user_id: user.id,
        user_email: user.email ?? "",
        active_card_id: body.cardId ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 });
  return Response.json({ ok: true });
}

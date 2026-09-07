import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { NextRequest } from "next/server";

interface SavedPlanRow {
  opportunity_id: string;
  article_title: string | null;
  outline: unknown[] | null;
  brief: unknown;
  saved_at: string;
}

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const { data, error: dbError } = await supabaseAdmin
    .from("v2_saved_plans")
    .select("opportunity_id, article_title, outline, brief, saved_at")
    .order("saved_at", { ascending: false });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  const plans = (data ?? []).map((row: SavedPlanRow) => ({
    opportunityId: row.opportunity_id,
    articleTitle: row.article_title ?? "",
    outline: row.outline ?? [],
    brief: row.brief ?? {},
    savedAt: row.saved_at,
  }));

  return Response.json(plans);
}

export async function POST(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const body = (await req.json()) as {
    opportunityId: string;
    articleTitle: string;
    outline: unknown[];
    brief: unknown;
    savedAt?: string;
  };

  const { error: dbError } = await supabaseAdmin
    .from("v2_saved_plans")
    .upsert(
      {
        opportunity_id: body.opportunityId,
        article_title: body.articleTitle,
        outline: body.outline,
        brief: body.brief,
        saved_at: body.savedAt ?? new Date().toISOString(),
      },
      { onConflict: "opportunity_id" }
    );

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  return Response.json({ ok: true });
}

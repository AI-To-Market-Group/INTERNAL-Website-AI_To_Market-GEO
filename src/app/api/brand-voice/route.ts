import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { invalidateBrandVoiceCache } from "@/lib/brand-voice";

export async function GET() {
  const { error: authError } = await requireUser();
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from("brand_voice")
    .select("*")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const body = (await req.json()) as {
    brand_description?: string;
    audience?: string;
    tone?: string[];
    preferred_style?: string[];
    forbidden_phrases?: string[];
    guardrails?: { label: string; active: boolean }[];
  };

  // Fetch current row id
  const { data: existing } = await supabaseAdmin
    .from("brand_voice")
    .select("id")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  const payload = { ...body, updated_at: new Date().toISOString() };

  let result;
  if (existing) {
    result = await supabaseAdmin
      .from("brand_voice")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    result = await supabaseAdmin
      .from("brand_voice")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  invalidateBrandVoiceCache();
  return NextResponse.json(result.data);
}

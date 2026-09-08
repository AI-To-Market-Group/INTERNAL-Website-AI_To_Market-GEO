import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  const { error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;

  const { error: dbError } = await supabaseAdmin
    .from("v2_saved_plans")
    .delete()
    .eq("opportunity_id", opportunityId);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  return Response.json({ ok: true });
}

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { ok, err, parseBody } from "@/lib/api-response";
import { deleteOpportunityForUser } from "@/lib/opportunities/db";
import { z } from "zod";

const schema = z.object({
  id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const success = await deleteOpportunityForUser(user.id, parsed.data.id);
  if (!success) return err("Not found", 404);

  return ok({ ok: true });
}

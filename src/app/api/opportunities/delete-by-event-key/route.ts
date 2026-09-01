import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { ok, err, parseBody } from "@/lib/api-response";
import { deleteOpportunitiesByEventKey } from "@/lib/opportunities/db";
import { z } from "zod";

const schema = z.object({
  date_event_key: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  try {
    await deleteOpportunitiesByEventKey(user.id, parsed.data.date_event_key);
    return ok({ ok: true });
  } catch {
    return err("Failed to delete opportunities for event", 500);
  }
}

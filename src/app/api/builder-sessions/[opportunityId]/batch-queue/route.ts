import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { updateSession } from "@/lib/builder-sessions-store";

type Params = { params: Promise<{ opportunityId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { opportunityId } = await params;
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as { queued?: boolean };
  if (typeof body.queued !== "boolean") {
    return err("queued (boolean) is required", 400, "BAD_REQUEST");
  }

  await updateSession(user.id, opportunityId, {
    batchQueuedAt: body.queued ? new Date().toISOString() : null,
  });

  return ok({ queued: body.queued });
}

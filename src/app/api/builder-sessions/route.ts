import type { NextRequest } from "next/server";
import { getAllSessions, getTrashedSessions, createSession } from "@/lib/builder-sessions-store";
import { parseBody, ok } from "@/lib/api-response";
import { builderSessionCreateSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const trashed = new URL(req.url).searchParams.get("trashed") === "true";
  const sessions = trashed
    ? await getTrashedSessions(user.id)
    : await getAllSessions(user.id);
  return ok(sessions);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, builderSessionCreateSchema);
  if (parsed.error) return parsed.error;

  const { opportunity_id, topic_title, opportunity_context } = parsed.data;
  const session = await createSession(user.id, { opportunity_id, topic_title, opportunity_context, creatorEmail: user.email ?? undefined });
  return ok(session);
}

import type { NextRequest } from "next/server";
import { getSession } from "@/lib/builder-sessions-store";
import { requireUser } from "@/lib/api-auth";
import { publishLiveToSanity } from "@/lib/sanity-publish";

type Params = { params: Promise<{ opportunityId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;
  const session = await getSession(user.id, opportunityId);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    const { documentId, studioUrl } = await publishLiveToSanity(session.sessionId);
    return Response.json({ id: documentId, link: studioUrl, status: "published" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

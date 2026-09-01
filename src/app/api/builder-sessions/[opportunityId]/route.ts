import type { NextRequest } from "next/server";
import { getSession, createSession, updateSession, deleteSession } from "@/lib/builder-sessions-store";
import { parseBody, ok } from "@/lib/api-response";
import { builderSessionUpdateSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/api-auth";
import type { OutlineSection, ArticleDraft, WordPressMetadata } from "@/types";

type Params = { params: Promise<{ opportunityId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;
  const session = await getSession(user.id, opportunityId);
  if (!session) {
    return ok({ found: false as const, opportunityId });
  }
  return ok({ ...session, found: true as const });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;
  const parsed = await parseBody(req, builderSessionUpdateSchema);
  if (parsed.error) return parsed.error;

  const body = parsed.data;
  let session = await getSession(user.id, opportunityId);
  if (!session) {
    await createSession(user.id, { opportunity_id: opportunityId, topic_title: "Untitled" });
  }
  session = await updateSession(user.id, opportunityId, {
    outline: body.outline as OutlineSection[] | undefined,
    article: body.article as ArticleDraft | null | undefined,
    metadataWordPress: body.metadataWordPress as WordPressMetadata | null | undefined,
    currentStep: body.currentStep,
    sentToWordPressAt: body.sentToWordPressAt,
  });
  return ok(session!);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { opportunityId } = await params;
  await deleteSession(user.id, opportunityId);
  return ok({ deleted: true });
}

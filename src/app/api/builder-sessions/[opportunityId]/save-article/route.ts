import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { getSession, updateSession } from "@/lib/builder-sessions-store";
import type { ArticleDraft, ArticleDraftBlock, GenerateArticleResponse } from "@/types";

type Params = { params: Promise<{ opportunityId: string }> };

function articleToBlocks(article: GenerateArticleResponse): ArticleDraftBlock[] {
  const blocks: ArticleDraftBlock[] = [];
  for (const section of article.sections) {
    blocks.push({
      id: `s${section.order}`,
      type: "heading",
      content: section.heading,
      meta: { sectionOrder: section.order, sectionType: section.type },
    });
    for (const para of section.content.paragraphs) {
      blocks.push({
        id: `s${section.order}p${para.id}`,
        type: "paragraph",
        content: para.text,
        meta: { sectionOrder: section.order, sectionType: section.type, paragraphId: para.id },
      });
    }
  }
  return blocks;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { opportunityId } = await params;
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as { article?: GenerateArticleResponse };
  if (!body.article?.sections?.length) {
    return err("article is required", 400, "BAD_REQUEST");
  }

  const session = await getSession(user.id, opportunityId);
  const existingDraftId = (session?.draft as ArticleDraft | null)?.id ?? `v2-${opportunityId}`;

  const draft: ArticleDraft = {
    id: existingDraftId,
    title: body.article.title ?? "",
    blocks: articleToBlocks(body.article),
    updatedAt: new Date().toISOString(),
  };

  await updateSession(user.id, opportunityId, { article: draft });
  return ok({ savedAt: draft.updatedAt });
}

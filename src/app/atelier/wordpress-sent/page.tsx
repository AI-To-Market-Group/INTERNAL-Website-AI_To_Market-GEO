"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useBuilderSessions } from "@/hooks/useBuilderSessions";
import { mapGenerateArticleResponseToDraft } from "@/lib/article-builder-utils";
import type { ArticleDraft, BuilderSessionInfo } from "@/types";

function normalizeDraft(session: BuilderSessionInfo): ArticleDraft | null {
  const draft = session.draft as Record<string, unknown> | null | undefined;
  if (!draft) return null;
  if (draft.blocks && Array.isArray(draft.blocks)) {
    return draft as unknown as ArticleDraft;
  }
  if (draft.sections && Array.isArray(draft.sections)) {
    return mapGenerateArticleResponseToDraft(draft as unknown as Parameters<typeof mapGenerateArticleResponseToDraft>[0]);
  }
  return null;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function isHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

function ArticleContent({ draft }: { draft: ArticleDraft }) {
  return (
    <article className="article-reading-scale rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{draft.title}</h1>
      <div className="max-w-3xl space-y-4">
        {(draft.blocks ?? []).map((block) => (
          <div key={block.id}>
            {block.type === "heading" ? (
              <h2 className="mb-2 text-lg font-semibold text-slate-800">{block.content}</h2>
            ) : isHtml(block.content) ? (
              <div
                className="text-base leading-relaxed text-slate-700 prose prose-slate max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
                dangerouslySetInnerHTML={{ __html: block.content }}
              />
            ) : (
              <p className="text-base leading-relaxed text-slate-700">{block.content}</p>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

export default function WordPressSentPage() {
  const router = useRouter();
  const { getSessionForOpportunity, getAllOpportunityIdsWithSessions } = useBuilderSessions();

  const sentSessions = (() => {
    const ids = getAllOpportunityIdsWithSessions?.() ?? [];
    return ids
      .map((id) => getSessionForOpportunity(id))
      .filter((s): s is NonNullable<typeof s> => s != null && Boolean(s.sentToWordPressAt))
      .sort((a, b) => (b.sentToWordPressAt ?? "").localeCompare(a.sentToWordPressAt ?? ""));
  })();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-6">
        <button
          type="button"
          onClick={() => router.push("/atelier")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Radar
        </button>

        <h1 className="mb-2 text-2xl font-bold text-slate-900">Articles sent to WordPress</h1>
        <p className="mb-6 text-sm text-slate-500">
          Drafts sent to WordPress. Click a title to view the article.
        </p>

        {sentSessions.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            No articles sent to WordPress yet.
          </div>
        ) : (
          <div className="space-y-3">
            {sentSessions.map((session) => {
              const id = session.opportunityId;
              const title = session.topicTitle ?? "Untitled";
              const sentAt = session.sentToWordPressAt;
              const draft = normalizeDraft({ ...session, opportunityId: id, topicTitle: title } as BuilderSessionInfo);
              const isExpanded = expandedId === id;

              return (
                <div
                  key={id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : id)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium text-slate-900">{title}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {sentAt && (
                        <span className="text-xs text-slate-500">{formatDate(sentAt)}</span>
                      )}
                      <ChevronDown
                        className={`h-5 w-5 text-slate-500 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-200 p-5 bg-slate-50">
                      {draft ? (
                        <>
                          <ArticleContent draft={draft} />
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => router.push(`/atelier/article-builder?opportunityId=${id}`)}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              Open in editor →
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-slate-500">Content not available.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

    </div>
  );
}

"use client";

import type { ArticleDraft } from "@/types";

interface PublishPreviewProps {
  draft: ArticleDraft | null;
}

function isHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

export function PublishPreview({ draft }: PublishPreviewProps) {
  if (!draft) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
        No draft to preview. Generate the article in step 2.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <article className="article-reading-scale rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-3xl font-bold text-slate-900">
          {draft.title}
        </h1>
        <div className="max-w-3xl mx-auto space-y-4">
          {(draft.blocks ?? []).map((block) => (
            <div key={block.id}>
              {block.type === "heading" ? (
                <h2 className="mb-3 text-xl font-semibold text-slate-800">
                  {block.content}
                </h2>
              ) : isHtml(block.content) ? (
                <div
                  className="text-base text-slate-700 leading-relaxed prose prose-slate max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic"
                  dangerouslySetInnerHTML={{ __html: block.content }}
                />
              ) : (
                <div className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {block.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

"use client";

import type { ArticleDraft } from "@/types";

interface TableOfContentsProps {
  draft: ArticleDraft;
  onSectionClick?: (blockId: string) => void;
  className?: string;
}

export function TableOfContents({
  draft,
  onSectionClick,
  className,
}: TableOfContentsProps) {
  const headings = draft.blocks.filter((b) => b.type === "heading");

  return (
    <nav className={className} aria-label="Table of contents">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Sommaire
      </p>
      <ul className="space-y-1 text-sm">
        <li>
          <button
            type="button"
            onClick={() =>
              document.getElementById("draft-h1")?.scrollIntoView({ behavior: "smooth" })
            }
            className="text-left font-medium text-slate-700 hover:text-slate-900"
          >
            {draft.title}
          </button>
        </li>
        {headings.map((block) => (
          <li key={block.id}>
            <button
              type="button"
              onClick={() => {
                document.getElementById(`block-${block.id}`)?.scrollIntoView({ behavior: "smooth" });
                onSectionClick?.(block.id);
              }}
              className="text-left text-slate-600 hover:text-slate-900"
            >
              — {block.content || "Untitled"}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

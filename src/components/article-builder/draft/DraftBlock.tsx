"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, RefreshCw } from "lucide-react";
import { RichTextBlockContent } from "./RichTextBlockContent";
import type { ArticleDraftBlock } from "@/types";

interface DraftBlockProps {
  block: ArticleDraftBlock;
  onContentChange: (content: string) => void;
  onAddAfter: () => void;
  onDelete: () => void;
  /** Regenerate this paragraph (only for type paragraph). */
  onRegenerate?: () => void;
  /** Regenerate entire section (only for heading). */
  onRegenerateSection?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Show section divider above this block (e.g. before headings, except first). */
  showDivider?: boolean;
}

export function DraftBlock({
  block,
  onContentChange,
  onAddAfter,
  onDelete,
  onRegenerate,
  onRegenerateSection,
  onFocus,
  onBlur,
  showDivider = false,
}: DraftBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} id={`block-${block.id}`} className="group">
      {showDivider && (
        <div className="flex items-center py-2">
          <div className="flex-1 border-t border-gray-200" />
        </div>
      )}
      <div
        className={`flex items-start gap-3 py-2 px-2 -mx-2 rounded-md transition-all hover:bg-gray-50 ${
          isDragging ? "opacity-80 shadow-lg ring-2 ring-primary/30 bg-white" : ""
        }`}
      >
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing pt-2 shrink-0"
          aria-label="Reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0 w-full">
          {block.type === "heading" ? (
            <input
              type="text"
              value={block.content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Titre de section"
              className="w-full text-lg sm:text-xl lg:text-2xl text-gray-900 border-none outline-none bg-transparent placeholder-gray-400 py-2 break-words"
              style={{
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                minWidth: 0,
              }}
            />
          ) : (
            <RichTextBlockContent
              value={block.content}
              onChange={onContentChange}
              placeholder="Start writing…"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1 pt-2 shrink-0">
          {block.type === "heading" && onRegenerateSection && (
            <button
              type="button"
              onClick={onRegenerateSection}
              className="p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
              title="Regenerate this section"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {block.type === "paragraph" && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
              title="Regenerate this paragraph"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onAddAfter}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
            title="Add paragraph"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

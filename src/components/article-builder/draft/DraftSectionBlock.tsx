"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RefreshCw, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextSectionContent } from "./RichTextSectionContent";
import type { ArticleDraftSection } from "@/types";

interface DraftSectionBlockProps {
  section: ArticleDraftSection;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onRewrite: () => void;
  onAddParagraph: () => void;
  onDelete: () => void;
}

export function DraftSectionBlock({
  section,
  onTitleChange,
  onContentChange,
  onRewrite,
  onAddParagraph,
  onDelete,
}: DraftSectionBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.sectionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      id={`section-${section.sectionId}`}
      className={`group relative rounded-lg border border-slate-200 bg-white p-4 ${
        isDragging ? "opacity-80 shadow-lg ring-2 ring-primary/30" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          aria-label="Reorder section"
          className="touch-none cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <input
          type="text"
          value={section.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="flex-1 border-0 bg-transparent text-lg font-semibold text-slate-900 outline-none focus:ring-0"
          placeholder={section.headingLevel === "H2" ? "Titre H2" : "Titre H3"}
        />
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600"
            onClick={onRewrite}
            title="Rewrite (with instruction)"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600"
            onClick={onAddParagraph}
            title="Add paragraph"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600 hover:text-red-600"
            onClick={onDelete}
            title="Delete section"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <RichTextSectionContent
        value={section.content}
        onChange={onContentChange}
        placeholder="Contenu de la section…"
      />
    </section>
  );
}

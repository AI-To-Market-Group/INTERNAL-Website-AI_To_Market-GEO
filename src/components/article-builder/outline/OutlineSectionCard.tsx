"use client";

import { useRef, useLayoutEffect } from "react";
import { GripVertical, RefreshCw, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OutlineSection } from "@/types";

interface OutlineSectionCardProps {
  section: OutlineSection;
  onUpdate: (section: OutlineSection) => void;
  onRegenerate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement> | null;
  isDragging?: boolean;
}

export function OutlineSectionCard({
  section,
  onUpdate,
  onRegenerate,
  onDuplicate,
  onDelete,
  dragHandleProps = null,
  isDragging = false,
}: OutlineSectionCardProps) {
  const updateTitle = (title: string) => onUpdate({ ...section, title });
  const updateContent = (content: string) => onUpdate({ ...section, content: content || undefined });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.overflow = "hidden";
    const newHeight = Math.max(60, el.scrollHeight);
    el.style.height = `${newHeight}px`;
    el.style.overflow = "auto";
  };

  useLayoutEffect(() => {
    adjustTextareaHeight();
    const t = setTimeout(adjustTextareaHeight, 50);
    return () => clearTimeout(t);
  }, [section.content]);

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition-shadow",
        isDragging && "opacity-80 shadow-lg ring-2 ring-primary/30"
      )}
    >
      {dragHandleProps && (
        <button
          type="button"
          aria-label="Reorder"
          className="mt-2 shrink-0 touch-none cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <Input
          value={section.title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Titre de la section"
          className="h-9 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0"
        />
        <textarea
          ref={textareaRef}
          value={section.content ?? ""}
          onChange={(e) => {
            updateContent(e.target.value);
            requestAnimationFrame(adjustTextareaHeight);
          }}
          rows={Math.max(2, (section.content ?? "").split("\n").length)}
          placeholder="Description de ce que la section couvrira…"
          className="w-full min-h-[4rem] resize-none overflow-y-auto rounded border-0 bg-transparent px-0 py-0 text-sm text-slate-600 placeholder:text-slate-400 outline-none focus:ring-0"
          aria-label="Contenu de la section"
        />
      </div>
      <div className="flex shrink-0 gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-slate-600"
          onClick={onRegenerate}
          title="Regenerate this section"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-slate-600"
          onClick={onDuplicate}
          title="Dupliquer"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-red-600"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

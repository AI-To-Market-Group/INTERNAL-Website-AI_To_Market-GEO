"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { OutlineSectionCard } from "./OutlineSectionCard";
import type { OutlineSection } from "@/types";

interface SortableOutlineSectionCardProps {
  section: OutlineSection;
  onUpdate: (section: OutlineSection) => void;
  onRegenerate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SortableOutlineSectionCard({
  section,
  onUpdate,
  onRegenerate,
  onDuplicate,
  onDelete,
}: SortableOutlineSectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <OutlineSectionCard
        section={section}
        onUpdate={onUpdate}
        onRegenerate={onRegenerate}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </li>
  );
}

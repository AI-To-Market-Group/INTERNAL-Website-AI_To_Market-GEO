"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { OutlineSectionCard } from "./OutlineSectionCard";
import { SortableOutlineSectionCard } from "./SortableOutlineSectionCard";
import type { OutlineSection } from "@/types";

interface OutlineSectionListProps {
  sections: OutlineSection[];
  onSectionsChange: (sections: OutlineSection[]) => void;
  onRegenerateSection: (sectionId: string) => void;
  onDuplicateSection: (section: OutlineSection) => void;
  onDeleteSection: (sectionId: string) => void;
}

export function OutlineSectionList({
  sections,
  onSectionsChange,
  onRegenerateSection,
  onDuplicateSection,
  onDeleteSection,
}: OutlineSectionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = [...sections];
    const [removed] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, removed);
    onSectionsChange(next);
  };

  const handleUpdateSection = (updated: OutlineSection) => {
    onSectionsChange(
      sections.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sections.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {sections.map((section) => (
            <SortableOutlineSectionCard
              key={section.id}
              section={section}
              onUpdate={handleUpdateSection}
              onRegenerate={() => onRegenerateSection(section.id)}
              onDuplicate={() => onDuplicateSection(section)}
              onDelete={() => onDeleteSection(section.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

"use client";

import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ViewToggleProps {
  value: "grid" | "table";
  onChange: (value: "grid" | "table") => void;
}

export const ViewToggle = ({ value, onChange }: ViewToggleProps) => {
  return (
    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
      <Button
        size="sm"
        variant={value === "grid" ? "default" : "ghost"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="mr-2 h-4 w-4" />
        Grille
      </Button>
      <Button
        size="sm"
        variant={value === "table" ? "default" : "ghost"}
        onClick={() => onChange("table")}
      >
        <TableIcon className="mr-2 h-4 w-4" />
        Tableau
      </Button>
    </div>
  );
};

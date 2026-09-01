"use client";

import { FileText, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CONTENT_THEME_IDS } from "@/types";

export type RadarFilter = "tous" | "saisonnier" | "tendance";

interface RadarFilterTabsProps {
  value: RadarFilter;
  onChange: (value: RadarFilter) => void;
  themeFilter?: string | null;
  onThemeFilterChange?: (theme: string | null) => void;
  showWithSessionsOnly?: boolean;
  onToggleWithSessions?: () => void;
}

const TABS: { id: RadarFilter; label: string }[] = [
  { id: "tous", label: "All" },
  { id: "saisonnier", label: "Seasonal" },
  { id: "tendance", label: "Trends" },
];

export function RadarFilterTabs({
  value,
  onChange,
  themeFilter = null,
  onThemeFilterChange,
  showWithSessionsOnly = false,
  onToggleWithSessions,
}: RadarFilterTabsProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          variant={value === tab.id ? "default" : "outline"}
          size="default"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
      {onThemeFilterChange && (
        <div className="ml-2 flex items-center gap-1.5 border-l border-slate-200 pl-2">
          <Tag className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <Select
            value={themeFilter ?? "all"}
            onValueChange={(v) => onThemeFilterChange(v === "all" ? null : v)}
          >
            <SelectTrigger size="sm" className="h-9 w-[180px] border-slate-200">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All themes</SelectItem>
              {CONTENT_THEME_IDS.map((themeId) => (
                <SelectItem key={themeId} value={themeId}>
                  {themeId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
        {onToggleWithSessions && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleWithSessions}
            className={cn(
              "h-9 w-9",
              showWithSessionsOnly
                ? "bg-primary/20 text-foreground hover:bg-primary/25"
                : "text-slate-400 hover:text-slate-600"
            )}
            title={showWithSessionsOnly ? "Show all opportunities" : "Show only those with a session in progress"}
          >
            <FileText className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

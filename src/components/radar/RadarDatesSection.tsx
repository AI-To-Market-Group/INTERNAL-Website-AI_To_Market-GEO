"use client";

import { useMemo, useState, useEffect } from "react";
import { Calendar, CalendarPlus, Trash2, Edit2, ChevronDown, ChevronUp, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isDateInActiveWindow } from "@/lib/date-utils";
import type { BigDate, UserSettings } from "@/types";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function formatDateSansAnnee(dateStr: string): string {
  const [, m, day] = dateStr.split("-").map(Number);
  return `${day} ${MONTHS_SHORT[m - 1]}`;
}

interface RadarDatesSectionProps {
  bigDates?: BigDate[];
  onUpdateSettings?: (settings: Partial<UserSettings>) => Promise<void>;
  /** Called after AI generates opportunities for a new date — should invalidate opportunities query. */
  onOpportunitiesGenerated?: () => void;
}

export function RadarDatesSection({
  bigDates = [],
  onUpdateSettings,
  onOpportunitiesGenerated,
}: RadarDatesSectionProps) {
  const [addDateOpen, setAddDateOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [newDateName, setNewDateName] = useState("");
  const [newDateStart, setNewDateStart] = useState("");
  const [newDateEnd, setNewDateEnd] = useState("");
  const [newDateDescription, setNewDateDescription] = useState("");
  const [newDateKeywords, setNewDateKeywords] = useState("");
  const [isSavingDate, setIsSavingDate] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const upcomingDates = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const in12Months = new Date(now);
    in12Months.setMonth(in12Months.getMonth() + 12);
    
    // Helper function to get next annual occurrence of a date
    const getNextAnnualOccurrence = (baseDateStr: string): Date => {
      const baseDate = new Date(baseDateStr + "T12:00:00");
      const currentYear = now.getFullYear();
      const month = baseDate.getMonth();
      const day = baseDate.getDate();
      
      // Try this year first
      const thisYearDate = new Date(currentYear, month, day);
      if (thisYearDate >= now) {
        return thisYearDate;
      }
      
      // If this year's date has passed, use next year
      return new Date(currentYear + 1, month, day);
    };
    
    return bigDates
      .filter((d) => d.is_active && d.date_start)
      .map((d) => {
        // Calculate next annual occurrence
        const startDate = getNextAnnualOccurrence(d.date_start);
        let endDate = d.date_end ? getNextAnnualOccurrence(d.date_end) : startDate;
        
        // If end date is before start date, it means we're crossing year boundary
        // (e.g., Dec 24 - Jan 1), so use next year's end date
        if (endDate < startDate) {
          endDate = new Date(endDate.getFullYear() + 1, endDate.getMonth(), endDate.getDate());
        }
        
        return {
          ...d,
          startDateObj: startDate,
          endDateObj: endDate,
        };
      })
      .filter((d) => {
        // Show if start date is within 12 months OR if it's currently ongoing (start <= now <= end)
        return (
          (d.startDateObj >= now && d.startDateObj <= in12Months) ||
          (d.startDateObj <= now && d.endDateObj >= now)
        );
      })
      .sort((a, b) => a.startDateObj.getTime() - b.startDateObj.getTime())
      .slice(0, 12)
      .map((d) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil(
          (d.startDateObj.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        return {
          ...d,
          daysLeft: daysLeft < 0 ? 0 : daysLeft, // 0 if already started
        };
      });
  }, [bigDates]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!addDateOpen) {
      setEditingDateId(null);
      setNewDateName("");
      setNewDateStart("");
      setNewDateEnd("");
      setNewDateDescription("");
      setNewDateKeywords("");
    }
  }, [addDateOpen]);

  // Load date data when editing
  useEffect(() => {
    if (editingDateId) {
      const dateToEdit = bigDates.find((d) => d.id === editingDateId);
      if (dateToEdit) {
        setNewDateName(dateToEdit.name);
        setNewDateStart(dateToEdit.date_start);
        setNewDateEnd(dateToEdit.date_end || "");
        setNewDateDescription(dateToEdit.description || "");
        setNewDateKeywords(dateToEdit.keywords?.join(", ") || "");
        setAddDateOpen(true);
      }
    }
  }, [editingDateId, bigDates]);

  const parseKeywords = (keywordsString: string): string[] => {
    return keywordsString
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  };

  const handleSaveDate = async () => {
    const name = newDateName.trim();
    const dateStart = newDateStart.trim();
    if (!name || !dateStart || !onUpdateSettings) return;
    setIsSavingDate(true);
    try {
      const keywords = parseKeywords(newDateKeywords);
      const dateToSave: BigDate = {
        id: editingDateId || `bd_${Date.now()}`,
        name,
        date_start: dateStart,
        date_end: newDateEnd.trim() || undefined,
        is_active: true,
        keywords,
        description: newDateDescription.trim() || undefined,
      };

      if (editingDateId) {
        await onUpdateSettings({
          big_dates: bigDates.map((d) => (d.id === editingDateId ? dateToSave : d)),
        });
      } else {
        await onUpdateSettings({ big_dates: [...bigDates, dateToSave] });
        // Auto-generate content opportunities for this new date
        generateOpportunitiesForDate(dateToSave);
      }

      setNewDateName("");
      setNewDateStart("");
      setNewDateEnd("");
      setNewDateDescription("");
      setNewDateKeywords("");
      setEditingDateId(null);
      setAddDateOpen(false);
    } finally {
      setIsSavingDate(false);
    }
  };

  /** Fire-and-forget: call AI to generate opportunities for a newly added date. */
  const generateOpportunitiesForDate = async (date: BigDate) => {
    setGeneratingFor(date.id);
    const toastId = toast.loading(
      `Generating content ideas for "${date.name}"…`,
      { duration: Infinity }
    );
    try {
      const res = await fetch("/api/opportunities/generate-for-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: date.name,
          date_start: date.date_start,
          date_end: date.date_end,
          keywords: date.keywords ?? [],
          description: date.description ?? "",
          count: 4,
        }),
      });
      const data = (await res.json()) as { count?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      toast.success(`${data.count ?? 4} content ideas added for "${date.name}"`, {
        id: toastId,
      });
      onOpportunitiesGenerated?.();
    } catch (e) {
      toast.error(
        `Could not generate ideas: ${e instanceof Error ? e.message : "Unknown error"}`,
        { id: toastId }
      );
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleEditDate = (id: string) => {
    setEditingDateId(id);
  };

  const handleRemoveDate = async (id: string) => {
    if (!onUpdateSettings) return;
    setIsSavingDate(true);
    try {
      // Delete linked opportunities first, then remove the event from settings
      const date = bigDates.find((d) => d.id === id);
      if (date) {
        const dateEventKey = `${date.name}_${date.date_start}`;
        await fetch("/api/opportunities/delete-by-event-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date_event_key: dateEventKey }),
        });
      }
      await onUpdateSettings({ big_dates: bigDates.filter((d) => d.id !== id) });
    } finally {
      setIsSavingDate(false);
    }
  };

  return (
    <>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Calendar className="h-5 w-5 text-primary" />
            Key dates
          </h2>
          {onUpdateSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddDateOpen(true)}
              className="gap-1.5 text-slate-600 hover:bg-slate-100"
            >
              <CalendarPlus className="h-4 w-4" />
              Add a date
            </Button>
          )}
        </div>
        {upcomingDates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              No key dates in the next 12 months.
            </p>
            {onUpdateSettings && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-slate-600"
                onClick={() => setAddDateOpen(true)}
              >
                Add a date
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {(expanded ? upcomingDates : upcomingDates.slice(0, 4)).map((d, i) => {
              const isClosest = i === 0;
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors ${
                    isClosest
                      ? "border-primary/40 bg-primary/5"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                  }`}
                  title={d.description ?? undefined}
                >
                  <Calendar
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isClosest ? "text-primary" : "text-slate-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold leading-tight text-slate-800">
                      {d.name}
                    </span>
                    <span className="text-xs tabular-nums text-slate-500">
                      {d.date_end && d.date_end !== d.date_start
                        ? `${formatDateSansAnnee(d.date_start)} → ${formatDateSansAnnee(d.date_end)}`
                        : formatDateSansAnnee(d.date_start)}
                      {d.daysLeft > 0 && ` J-${d.daysLeft}`}
                    </span>
                  </div>
                  {generatingFor === d.id && (
                    <Loader2 className="ml-1 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                  )}
                  {onUpdateSettings && (
                    <div className="ml-0.5 flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        onClick={() => generateOpportunitiesForDate(d)}
                        disabled={!!generatingFor}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary disabled:opacity-50"
                        title="Regenerate content ideas"
                      >
                        {generatingFor === d.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Sparkles className="h-3.5 w-3.5" />
                        }
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditDate(d.id)}
                        disabled={isSavingDate || !!generatingFor}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary disabled:opacity-50"
                        title="Edit"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDate(d.id)}
                        disabled={isSavingDate || !!generatingFor}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
            {upcomingDates.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((e) => !e)}
                className="w-fit gap-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    See less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    See more ({upcomingDates.length - 4} more)
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={addDateOpen} onOpenChange={setAddDateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              {editingDateId ? "Edit key date" : "Add key date"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <label
                htmlFor="bigdate-name"
                className="text-sm font-medium text-slate-700"
              >
                Event name
              </label>
              <Input
                id="bigdate-name"
                value={newDateName}
                onChange={(e) => setNewDateName(e.target.value)}
                placeholder="e.g. Black Friday"
                className="border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="bigdate-date-start"
                className="text-sm font-medium text-slate-700"
              >
                Start date <span className="text-red-500">*</span>
              </label>
              <Input
                id="bigdate-date-start"
                type="date"
                value={newDateStart}
                onChange={(e) => setNewDateStart(e.target.value)}
                className="border-slate-200"
                required
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="bigdate-date-end"
                className="text-sm font-medium text-slate-700"
              >
                End date (optional)
              </label>
              <Input
                id="bigdate-date-end"
                type="date"
                value={newDateEnd}
                onChange={(e) => setNewDateEnd(e.target.value)}
                className="border-slate-200"
                min={newDateStart || undefined}
              />
              {newDateEnd && newDateEnd < newDateStart && (
                <p className="text-xs text-red-500">
                  End date must be after start date
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label
                htmlFor="bigdate-keywords"
                className="text-sm font-medium text-slate-700"
              >
                Keywords (optional)
              </label>
              <Input
                id="bigdate-keywords"
                value={newDateKeywords}
                onChange={(e) => setNewDateKeywords(e.target.value)}
                placeholder="e.g. AI marketing automation, LLM adoption, B2B sales AI"
                className="border-slate-200"
              />
              <p className="text-xs text-slate-500">
                Separate keywords with commas
              </p>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="bigdate-desc"
                className="text-sm font-medium text-slate-700"
              >
                AI To Market interest (optional)
              </label>
              <textarea
                id="bigdate-desc"
                value={newDateDescription}
                onChange={(e) => setNewDateDescription(e.target.value)}
                placeholder="e.g. AI strategy content, thought leadership, ICP education."
                rows={3}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddDateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveDate}
              disabled={
                !newDateName.trim() ||
                !newDateStart.trim() ||
                isSavingDate ||
                Boolean(newDateEnd && newDateEnd < newDateStart)
              }
            >
              {isSavingDate
                ? editingDateId
                  ? "Saving…"
                  : "Adding…"
                : editingDateId
                  ? "Update date"
                  : "Add date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

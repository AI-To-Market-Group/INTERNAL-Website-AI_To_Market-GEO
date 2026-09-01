"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  CalendarPlus,
  Trash2,
  Edit2,
  TrendingUp,
  Users,
  ExternalLink,
  FileText,
  Globe,
  Target,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useGapConcurrence } from "@/hooks/useGapConcurrence";
import { useTendancesThemes } from "@/hooks/useTendancesThemes";
import { CONTENT_THEME_IDS } from "@/types";
import type { BigDate, UserSettings } from "@/types";
import type { Opportunity } from "@/types";

interface SecondarySectionsProps {
  bigDates?: BigDate[];
  opportunities?: Opportunity[];
  /** To add/remove dates from the Key dates section. */
  onUpdateSettings?: (settings: Partial<UserSettings>) => Promise<void>;
  /** Called when the user clicks a topic (Trends by theme) to select it. */
  onChooseTopic?: (topic: string) => void;
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  onRefresh,
  isRefreshing,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
          )}
          <Icon className="h-4 w-4 shrink-0 text-slate-500" />
          {title}
        </button>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            disabled={isRefreshing}
            className="shrink-0 text-slate-500"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>
      {open && <div className="border-t border-slate-100 px-4 py-3">{children}</div>}
    </div>
  );
}

export function SecondarySections({
  bigDates = [],
  opportunities = [],
  onUpdateSettings,
  onChooseTopic,
}: SecondarySectionsProps) {
  const [addDateOpen, setAddDateOpen] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [newDateName, setNewDateName] = useState("");
  const [newDateStart, setNewDateStart] = useState("");
  const [newDateEnd, setNewDateEnd] = useState("");
  const [newDateDescription, setNewDateDescription] = useState("");
  const [newDateKeywords, setNewDateKeywords] = useState("");
  const [isSavingDate, setIsSavingDate] = useState(false);

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
        // Show if start date is within 12 months OR if it's currently ongoing
        return (
          (d.startDateObj >= now && d.startDateObj <= in12Months) ||
          (d.startDateObj <= now && d.endDateObj >= now)
        );
      })
      .sort((a, b) => a.startDateObj.getTime() - b.startDateObj.getTime())
      .slice(0, 12)
      .map((d) => {
        const daysLeft = Math.ceil(
          (d.startDateObj.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        return {
          ...d,
          daysLeft: daysLeft < 0 ? 0 : daysLeft,
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
        // Update existing date
        await onUpdateSettings({
          big_dates: bigDates.map((d) => (d.id === editingDateId ? dateToSave : d)),
        });
      } else {
        // Add new date
        await onUpdateSettings({ big_dates: [...bigDates, dateToSave] });
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

  const {
    harvestTopics,
    generatedTopics,
    isLoading: tendancesLoading,
    refetch: refetchTendances,
    isFetching: isRefreshingTendances,
  } = useTendancesThemes();
  const themesData = generatedTopics?.generated_topics?.themes ?? {};

  const {
    brandBlogs,
    competitorsBlogs,
    topicGaps,
    competitorTopicsByTheme,
    isLoading: gapLoading,
    refetch: refetchGap,
    isFetching: isRefreshingGap,
  } = useGapConcurrence();
  const competitorThemesData = competitorTopicsByTheme?.generated_topics?.themes ?? {};

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">
        Week context
      </h2>
      <CollapsibleSection title="Key dates" icon={Calendar}>
        <div className="space-y-4">
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
            <>
              {/* 1. Key dates row — label + Add button on same line, compact cards */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Key dates
                  </p>
                  {onUpdateSettings && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddDateOpen(true)}
                      className="h-7 gap-1 px-2 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      title="Add a key date"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {upcomingDates.map((d, i) => {
                    const isClosest = i === 0;
                    return (
                      <div
                        key={d.id}
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                          isClosest
                            ? "border-primary/40 bg-primary/5"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                        }`}
                        title={d.description ?? undefined}
                      >
                        <Calendar
                          className={`h-3.5 w-3.5 shrink-0 ${isClosest ? "text-primary" : "text-slate-400"}`}
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold leading-tight text-slate-800">
                            {d.name}
                          </span>
                          <span className="text-[10px] tabular-nums text-slate-500">
                            J-{d.daysLeft}
                          </span>
                        </div>
                        {onUpdateSettings && (
                          <div className="ml-0.5 flex shrink-0 gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleEditDate(d.id)}
                              disabled={isSavingDate}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary disabled:opacity-50"
                              title="Edit"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDate(d.id)}
                              disabled={isSavingDate}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Topics for the next date — clean grid */}
              {(() => {
                const closest = upcomingDates[0];
                const onePerTheme = CONTENT_THEME_IDS.map((themeId) => {
                  const topics = themesData[themeId] ?? [];
                  return { themeId, topic: topics[0] };
                }).filter((x) => x.topic);
                if (onePerTheme.length === 0) return null;
                return (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      One topic per theme for {closest.name}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {onePerTheme.map(({ themeId, topic }) => (
                        <button
                          key={themeId}
                          type="button"
                          onClick={() => onChooseTopic?.(topic.topic)}
                          className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
                          title="Choose this topic"
                        >
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            {themeId}
                          </span>
                          <span className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">
                            {topic.topic}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </CollapsibleSection>

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
              <label htmlFor="bigdate-name" className="text-sm font-medium text-slate-700">
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
              <label htmlFor="bigdate-date-start" className="text-sm font-medium text-slate-700">
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
              <label htmlFor="bigdate-date-end" className="text-sm font-medium text-slate-700">
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
              <label htmlFor="bigdate-keywords" className="text-sm font-medium text-slate-700">
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
              <label htmlFor="bigdate-desc" className="text-sm font-medium text-slate-700">
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
      <CollapsibleSection
        title="Content themes"
        icon={TrendingUp}
        onRefresh={refetchTendances}
        isRefreshing={isRefreshingTendances}
      >
        {tendancesLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-4">
            {harvestTopics && harvestTopics.top_topics.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Trending topics (search)
                </p>
                <div className="flex flex-wrap gap-2">
                  {harvestTopics.top_topics.slice(0, 8).map((t, i) => (
                    <span
                      key={i}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                      title={`Volume: ${t.Nq.toLocaleString("en-US")} · Score: ${Math.round(t.topic_score)}`}
                    >
                      {t.Ph}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTENT_THEME_IDS.map((themeId) => {
                const topics = themesData[themeId] ?? [];
                if (topics.length === 0) return null;
                return (
                  <div
                    key={themeId}
                    className="rounded-md border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {themeId}
                    </p>
                    <ul className="space-y-1.5">
                      {topics.slice(0, 3).map((t, i) => (
                        <li key={i} className="border-b border-slate-50 last:border-0">
                          <button
                            type="button"
                            onClick={() => onChooseTopic?.(t.topic)}
                            className="flex w-full cursor-pointer items-start gap-2 rounded-md py-1.5 pr-1 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 disabled:cursor-default disabled:opacity-60"
                            title="Choose this topic"
                          >
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                            <div className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-sm text-slate-700">{t.topic}</span>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                <span className="text-[10px] tabular-nums text-slate-500">Score {t.score}</span>
                                {t.content_intents.slice(0, 2).map((intent) => (
                                  <span
                                    key={intent}
                                    className="rounded border border-slate-100 bg-slate-50 px-1 text-[10px] text-slate-500"
                                  >
                                    {intent}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            {CONTENT_THEME_IDS.every((id) => !themesData[id]?.length) && !harvestTopics?.top_topics.length && (
              <p className="text-sm text-slate-500">No trends data available.</p>
            )}
          </div>
        )}
      </CollapsibleSection>
      <CollapsibleSection
        title="Competition gap analysis"
        icon={Users}
        onRefresh={refetchGap}
        isRefreshing={isRefreshingGap}
      >
        {gapLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {brandBlogs && brandBlogs.blogs.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      AI To Market blog
                    </span>
                  </div>
                  <span className="text-xs tabular-nums text-slate-500">{brandBlogs.count}</span>
                </div>
                <div
                  className="max-h-[14rem] overflow-y-auto overflow-x-hidden pr-1"
                  style={{ scrollbarGutter: "stable" }}
                >
                  <ul className="space-y-1.5">
                    {brandBlogs.blogs.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 border-b border-slate-50 py-1.5 last:border-0">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                        <span className="line-clamp-2 text-sm text-slate-700">{b.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {competitorsBlogs && competitorsBlogs.blogs.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Competitors
                    </span>
                  </div>
                  <span className="text-xs tabular-nums text-slate-500">{competitorsBlogs.count}</span>
                </div>
                <div
                  className="max-h-[14rem] overflow-y-auto overflow-x-hidden pr-1"
                  style={{ scrollbarGutter: "stable" }}
                >
                  <ul className="space-y-2">
                    {competitorsBlogs.blogs.map((b, i) => (
                      <li key={i} className="border-b border-slate-50 py-1.5 last:border-0">
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 text-sm text-slate-700 hover:text-slate-900"
                        >
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 line-clamp-2">{b.title}</span>
                        </a>
                        <span className="ml-5 block text-xs text-slate-500">{b.source}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 1. Sujets couverts uniquement par la concurrence — en premier */}
            {topicGaps && topicGaps.competitor_only_topics.length > 0 && (
              <div className="sm:col-span-2 rounded-md border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Target className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Sujets couverts uniquement par la concurrence
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {topicGaps.competitor_only_topics.map((g, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-slate-100 bg-slate-50/50 p-3"
                    >
                      <p className="text-sm leading-snug text-slate-700">{g.topic}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Topics by theme (competition) — same layout as Trends by theme */}
            {CONTENT_THEME_IDS.some((id) => (competitorThemesData[id] ?? []).length > 0) && (
              <div className="sm:col-span-2 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Topics by theme (competition)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CONTENT_THEME_IDS.map((themeId) => {
                    const topics = competitorThemesData[themeId] ?? [];
                    if (topics.length === 0) return null;
                    return (
                      <div
                        key={themeId}
                        className="rounded-md border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      >
                        <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {themeId}
                        </p>
                        <ul className="space-y-1.5">
                          {topics.slice(0, 3).map((t, i) => (
                            <li key={i} className="border-b border-slate-50 last:border-0">
                              <button
                                type="button"
                                onClick={() => onChooseTopic?.(t.topic)}
                                className="flex w-full cursor-pointer items-start gap-2 rounded-md py-1.5 pr-1 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1"
                                title="Choose this topic"
                              >
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                                <div className="min-w-0 flex-1">
                                  <span className="line-clamp-2 text-sm text-slate-700">{t.topic}</span>
                                  <div className="mt-0.5 flex flex-wrap gap-1">
                                    <span className="text-[10px] tabular-nums text-slate-500">
                                      Score {t.score}
                                    </span>
                                    {t.content_intents?.slice(0, 2).map((intent) => (
                                      <span
                                        key={intent}
                                        className="rounded border border-slate-100 bg-slate-50 px-1 text-[10px] text-slate-500"
                                      >
                                        {intent}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!brandBlogs?.blogs.length &&
              !competitorsBlogs?.blogs.length &&
              !CONTENT_THEME_IDS.some((id) => (competitorThemesData[id] ?? []).length > 0) &&
              !topicGaps?.competitor_only_topics.length && (
                <div className="sm:col-span-2 rounded-md border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">No data available.</p>
                </div>
              )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

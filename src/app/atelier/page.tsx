"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { CardSkeleton } from "@/components/radar/CardSkeleton";
import { OpportunityCard } from "@/components/radar/OpportunityCard";
import { Top4OpportunitiesTable } from "@/components/radar/Top4OpportunitiesTable";
import {
  RadarFilterTabs,
  type RadarFilter,
} from "@/components/radar/RadarFilterTabs";
import { RadarDatesSection } from "@/components/radar/RadarDatesSection";
import { KeywordWorkspace } from "@/components/radar/KeywordWorkspace";
import { useOpportunities } from "@/hooks/useOpportunities";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useBuilderSessions } from "@/hooks/useBuilderSessions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Shuffle, BookOpen, Plus, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Opportunity, UserSettings } from "@/types";
import { CONTENT_THEME_IDS } from "@/types";

/** Display limits per source (subset of pool). Pool sizes: gap 20, trend 20, date 12 */
const DISPLAY_LIMITS = { gap: 8, trend: 8, date: 8 } as const;

function getSource(opp: Opportunity): "gap" | "trend" | "date" {
  const s = opp.sources ?? [];
  const t = opp.type;
  if (s.includes("gap") || t === "SEO_GAP") return "gap";
  if (s.includes("trend") || t === "TREND") return "trend";
  return "date";
}

/** Pick n random items from arr using seed (seeded shuffle for reproducibility). */
function pickRandomSubset<T>(arr: T[], n: number, seed: number): T[] {
  if (arr.length <= n) return [...arr];
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

function matchesFilter(opp: Opportunity, filter: RadarFilter): boolean {
  if (filter === "tous") return true;
  const sources = opp.sources ?? [];
  const type = opp.type;
  if (filter === "saisonnier")
    return sources.includes("date") || type === "SEASONAL";
  if (filter === "tendance") return sources.includes("trend") || type === "TREND";
  return true;
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RadarFilter>("tous");
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [showWithSessionsOnly, setShowWithSessionsOnly] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Add opportunity dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addSeason, setAddSeason] = useState("");
  const [addDays, setAddDays] = useState("");
  const [addScore, setAddScore] = useState("50");
  const [addTheme, setAddTheme] = useState(CONTENT_THEME_IDS[0] as string);
  const [addSaving, setAddSaving] = useState(false);

  // Quick prompt bar
  const [promptText, setPromptText] = useState("");
  const [promptSaving, setPromptSaving] = useState(false);

  const opportunitiesQuery = useOpportunities();
  const settingsQuery = useSettings();
  const { hasSession, hasSessionWithOutline, hasSentToWordPress } = useBuilderSessions();
  const updateSettings = useUpdateSettings();

  const opportunities = opportunitiesQuery.data?.data ?? [];
  const sorted = useMemo(
    () =>
      [...opportunities].sort(
        (a, b) =>
          (b.score ?? b.impact_score ?? 0) - (a.score ?? a.impact_score ?? 0)
      ),
    [opportunities]
  );

  const bySource = useMemo(() => {
    const gap: Opportunity[] = [];
    const trend: Opportunity[] = [];
    const date: Opportunity[] = [];
    for (const o of sorted) {
      const src = getSource(o);
      if (src === "gap") gap.push(o);
      else if (src === "trend") trend.push(o);
      else date.push(o);
    }
    return { gap, trend, date };
  }, [sorted]);

  const sortByScore = (a: Opportunity, b: Opportunity) =>
    (b.score ?? b.impact_score ?? 0) - (a.score ?? a.impact_score ?? 0);

  /** Seasonal: group by date_event_key, pick up to 4 per group (shuffled via seed). */
  const displayedByDate = useMemo(() => {
    if (filter !== "saisonnier" || bySource.date.length === 0) return [];
    const grouped = new Map<string, Opportunity[]>();
    for (const o of bySource.date) {
      const key = o.date_event_key ?? o.active_season ?? "unknown";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(o);
    }
    let rowIndex = 0;
    const rows = Array.from(grouped.entries()).map(([key, opps]) => {
      const sortedOpps = [...opps].sort(sortByScore);
      const picked = pickRandomSubset(sortedOpps, 4, shuffleSeed + 100 + rowIndex);
      rowIndex += 1;
      return {
        key,
        eventName: opps[0]?.active_season ?? opps[0]?.metrics?.event_name ?? key.split("_")[0] ?? "Date",
        total: opps.length,
        opps: picked,
      };
    });
    rows.sort((a, b) => {
      const dateA = a.key.split("_")[1] ?? "";
      const dateB = b.key.split("_")[1] ?? "";
      return dateA.localeCompare(dateB);
    });
    return rows;
  }, [bySource.date, filter, shuffleSeed]);

  const displayed = useMemo(() => {
    const g = pickRandomSubset(bySource.gap, DISPLAY_LIMITS.gap, shuffleSeed);
    const t = pickRandomSubset(bySource.trend, DISPLAY_LIMITS.trend, shuffleSeed + 1);
    const d = pickRandomSubset(bySource.date, DISPLAY_LIMITS.date, shuffleSeed + 2);
    let result: Opportunity[];
    if (filter === "tous") {
      result = [...g, ...t, ...d].sort(sortByScore);
    } else if (filter === "tendance") {
      result = [...t].sort(sortByScore);
    } else {
      result = [...d].sort(sortByScore);
    }
    return result;
  }, [bySource, filter, shuffleSeed]);

  const filtered = useMemo(() => {
    let result = [...displayed];
    if (showWithSessionsOnly) {
      result = result.filter((o) => hasSessionWithOutline(o.id));
    }
    if (themeFilter) {
      result = result.filter((o) => (o.theme ?? "—") === themeFilter);
    }
    return result;
  }, [displayed, themeFilter, showWithSessionsOnly, hasSessionWithOutline]);

  const handleReload = useCallback(() => {
    setShuffleSeed((s) => s + 100);
  }, []);

  const handleChoose = (id: string) => {
    router.push(`/atelier/article-builder?opportunityId=${id}`);
  };

  const handleUpdateSettings = async (updates: Partial<UserSettings>) => {
    try {
      await updateSettings.mutateAsync(updates);
      toast.success("Settings updated.");
    } catch {
      toast.error("Unable to save settings.");
    }
  };

  /* ---- Delete opportunity ---- */
  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch("/api/opportunities/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Opportunity deleted.");
    } catch {
      toast.error("Failed to delete.");
    }
  }, [queryClient]);

  /* ---- Quick prompt bar: create opportunity from free-form topic ---- */
  const handlePromptCreate = useCallback(async () => {
    const topic = promptText.trim();
    if (!topic) return;
    setPromptSaving(true);
    try {
      const res = await fetch("/api/opportunities/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic,
          type: "SEO_GAP",
          score: 50,
          theme: CONTENT_THEME_IDS[0],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Opportunity created.");
      setPromptText("");
    } catch {
      toast.error("Failed to create opportunity.");
    } finally {
      setPromptSaving(false);
    }
  }, [promptText, queryClient]);

  /* ---- Add opportunity ---- */
  const handleAddOpportunity = useCallback(async () => {
    if (!addTitle.trim()) return;
    setAddSaving(true);
    try {
      const res = await fetch("/api/opportunities/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          type: filter === "tendance" ? "TREND" : filter === "saisonnier" ? "SEASONAL" : "SEO_GAP",
          active_season: addSeason.trim() || undefined,
          date_event_key: addSeason.trim() ? `${addSeason.trim()}_custom` : undefined,
          score: Math.min(100, Math.max(0, Number(addScore) || 50)),
          theme: addTheme,
          days_until_event: addDays ? Number(addDays) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Opportunity added.");
      setAddOpen(false);
      setAddTitle("");
      setAddSeason("");
      setAddDays("");
      setAddScore("50");
    } catch {
      toast.error("Failed to add opportunity.");
    } finally {
      setAddSaving(false);
    }
  }, [addTitle, addSeason, addDays, addScore, addTheme, filter, queryClient]);

  const settings = settingsQuery.data ?? { seed_keywords: [], big_dates: [] };

  const handleSelectTitleFromCommand = (title: string) => {
    router.push(
      `/atelier/article-builder?opportunityId=from-command&topic=${encodeURIComponent(title)}`
    );
  };

  /* ---- "Other suggestions" is meaningful when there's a larger pool than displayed ---- */
  const hasMoreToShuffle =
    (filter === "saisonnier" && bySource.date.length > 4) ||
    (filter === "tendance" && bySource.trend.length > DISPLAY_LIMITS.trend) ||
    (filter === "tous" && opportunities.length > DISPLAY_LIMITS.gap + DISPLAY_LIMITS.trend + DISPLAY_LIMITS.date);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        commandBarProps={{
          onSelectTitle: handleSelectTitleFromCommand,
        }}
      />

      <main className="mx-auto max-w-7xl px-6 py-6">
        <RadarFilterTabs
          value={filter}
          onChange={setFilter}
          themeFilter={themeFilter}
          onThemeFilterChange={setThemeFilter}
          showWithSessionsOnly={showWithSessionsOnly}
          onToggleWithSessions={() => {
            setShowWithSessionsOnly((prev) => !prev);
          }}
        />

        {/* ── Quick prompt bar ──────────────────────────────────────────────── */}
        <form
          onSubmit={(e) => { e.preventDefault(); handlePromptCreate(); }}
          className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200 transition-shadow"
        >
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Type a topic to create a new opportunity card…"
            disabled={promptSaving}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!promptText.trim() || promptSaving}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
          >
            {promptSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Create
          </button>
        </form>

        <KeywordWorkspace seedKeywords={settings?.seed_keywords ?? []} />

        {filter === "tous" && !opportunitiesQuery.isLoading && filtered.length > 0 && (
          <Top4OpportunitiesTable
            opportunities={filtered}
            onGenerate={handleChoose}
            hasSession={hasSessionWithOutline}
            hasSentToWordPress={hasSentToWordPress}
          />
        )}

        {filter === "saisonnier" && (
          <RadarDatesSection
            bigDates={settings?.big_dates}
            onUpdateSettings={handleUpdateSettings}
            onOpportunitiesGenerated={() =>
              queryClient.invalidateQueries({ queryKey: ["opportunities"] })
            }
          />
        )}


        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">
            All opportunities
          </h2>
          <div className="flex items-center gap-2">
            {hasMoreToShuffle && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReload}
                className="gap-1.5 border-slate-200"
              >
                <Shuffle className="h-4 w-4" />
                Other suggestions
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="gap-1.5 border-slate-200"
            >
              <Plus className="h-4 w-4" />
              Add opportunity
            </Button>
          </div>
        </div>

        {filter === "saisonnier" && !opportunitiesQuery.isLoading && bySource.date.length === 0 ? (
          <div className="col-span-full rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-500">No seasonal opportunities yet.</p>
            <p className="mt-1 text-sm text-slate-400">
              Add one using the button above.
            </p>
          </div>
        ) : filter === "saisonnier" && displayedByDate.length > 0 ? (
          <div className="space-y-6">
            {displayedByDate.map((row) => (
              <div key={row.key}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">{row.eventName}</h3>
                  {row.total > 4 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {row.total} total · showing 4
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 auto-rows-fr md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {row.opps.map((opp) => (
                    <OpportunityCard
                      key={opp.id}
                      data={opp}
                      onGenerate={handleChoose}
                      onDelete={handleDelete}
                      isLoading={false}
                      hasSession={hasSessionWithOutline(opp.id)}
                      sentToWordPress={hasSentToWordPress(opp.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 auto-rows-fr md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {opportunitiesQuery.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))
            ) : opportunitiesQuery.isError ? (
              <div className="col-span-full rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-slate-600">
                  An error occurred.{" "}
                  <button
                    type="button"
                    onClick={() => opportunitiesQuery.refetch()}
                    className="text-primary hover:underline"
                  >
                    Retry
                  </button>
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-slate-500">
                  No opportunities for this filter.
                </p>
              </div>
            ) : (
              filtered.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  data={opp}
                  onGenerate={handleChoose}
                  onDelete={handleDelete}
                  isLoading={false}
                  hasSession={hasSessionWithOutline(opp.id)}
                  sentToWordPress={hasSentToWordPress(opp.id)}
                />
              ))
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/content-forge">
            <Button
              variant="outline"
              className="inline-flex items-center gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4" />
              Content Forge
            </Button>
          </Link>
        </div>
      </main>

      {/* ---- Add Opportunity Dialog ---- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add an opportunity
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                autoFocus
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="e.g. How AI agents reduce B2B sales cycles"
                className="border-slate-200"
              />
            </div>
            {(filter === "saisonnier" || filter === "tous") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Seasonal event (optional)
                </label>
                <Input
                  value={addSeason}
                  onChange={(e) => setAddSeason(e.target.value)}
                  placeholder="e.g. Summer, Black Friday, Back to school"
                  className="border-slate-200"
                />
              </div>
            )}
            {(filter === "saisonnier" || filter === "tous") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Days until event (optional)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={addDays}
                  onChange={(e) => setAddDays(e.target.value)}
                  placeholder="e.g. 30"
                  className="border-slate-200"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Score (0–100)
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={addScore}
                onChange={(e) => setAddScore(e.target.value)}
                className="border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Theme
              </label>
              <select
                value={addTheme}
                onChange={(e) => setAddTheme(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CONTENT_THEME_IDS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleAddOpportunity}
              disabled={!addTitle.trim() || addSaving}
            >
              {addSaving ? "Adding…" : "Add opportunity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

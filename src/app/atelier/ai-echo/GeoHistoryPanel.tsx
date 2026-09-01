"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  History,
  Loader2,
  ArrowLeft,
  Target,
  Clock,
  DollarSign,
  PieChart,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Building2,
  Link2,
  Cpu,
} from "lucide-react";
import type { GeoPromptResult } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface GeoRunSummary {
  runId: string;
  companyName?: string;
  mainUrl?: string;
  prompts: string[];
  avgCitationRate: number;
  totalEstimatedCostUsd?: number;
  totalLatencyMs?: number;
  targetLLMs?: string[];
  model?: string;
  createdAt: string;
}

interface GeoRunDetail extends GeoRunSummary {
  results: GeoPromptResult[];
}

interface HistoryResponse {
  runs: GeoRunSummary[];
  total: number;
}

interface RunDetailResponse {
  run: GeoRunDetail | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatCost(usd?: number): string {
  if (usd == null) return "—";
  if (usd < 0.01) return `$${(usd * 1000).toFixed(2)}m`;
  return `$${usd.toFixed(4)}`;
}

function positionLabel(p?: string | null): string {
  if (!p) return "—";
  const labels: Record<string, string> = {
    top_1: "Top: 1%",
    top_10: "Top: 10%",
    top_25: "Top: 25%",
    top_33: "Top: 33%",
    top_50: "Top: 50%",
    top_66: "Top: 66%",
    top_75: "Top: 75%",
  };
  return labels[p] ?? p.replace(/_/g, " ");
}

function confidenceLabel(score?: number): string {
  if (!score) return "—";
  if (score >= 5) return "Strong";
  if (score >= 3) return "Medium";
  if (score >= 1) return "Mention";
  return "—";
}

function confidenceColor(score?: number): string {
  if (!score) return "";
  if (score >= 5) return "bg-emerald-100 text-emerald-800";
  if (score >= 3) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

// ── Trend chart ────────────────────────────────────────────────────────────

function CitationTrendChart({ runs }: { runs: GeoRunSummary[] }) {
  if (runs.length < 2) return null;

  const chartWidth = 520;
  const chartHeight = 140;
  const padX = 30;   // left margin for Y labels
  const padY = 20;   // top margin for value labels above dots
  const padBottom = 28; // bottom margin for date labels

  const innerW = chartWidth - padX - 12;
  const innerH = chartHeight - padY - padBottom;

  // Y axis is always 0–100 % (absolute scale)
  const toY = (rate: number) => padY + innerH - (rate / 100) * innerH;

  const coords = runs.map((r, i) => ({
    x: padX + (runs.length === 1 ? innerW / 2 : (i / (runs.length - 1)) * innerW),
    y: toY(r.avgCitationRate),
    rate: r.avgCitationRate,
    date: r.createdAt,
    runId: r.runId,
  }));

  const pointStr = coords.map((c) => `${c.x},${c.y}`).join(" L");
  const pathD = `M${pointStr}`;
  const areaD = `M${padX},${padY + innerH} L${pointStr} L${coords[coords.length - 1]!.x},${padY + innerH} Z`;

  const latestRate = runs[runs.length - 1]?.avgCitationRate ?? 0;
  const prevRate = runs[runs.length - 2]?.avgCitationRate ?? 0;
  const trend = latestRate - prevRate;

  // Show a date label every N points so they don't overlap
  const maxLabels = 6;
  const step = Math.max(1, Math.ceil(runs.length / maxLabels));

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Citation Rate over time
          </CardTitle>
          <span
            className={`text-sm font-bold ${
              trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-slate-500"
            }`}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend).toFixed(0)} pp
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ height: 160 }}>
          {/* Y-axis grid lines — fixed 0/25/50/75/100 % */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = toY(pct);
            return (
              <g key={pct}>
                <line
                  x1={padX} y1={y} x2={padX + innerW} y2={y}
                  stroke="currentColor" strokeOpacity={pct === 0 ? 0.15 : 0.07} strokeWidth={1}
                  strokeDasharray={pct === 0 ? undefined : "3 3"}
                />
                <text x={padX - 4} y={y + 4} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.45}>
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill="rgb(99,102,241)" fillOpacity={0.07} />

          {/* Line */}
          <path d={pathD} fill="none" stroke="rgb(99,102,241)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points + value labels */}
          {coords.map((c, i) => {
            const labelAbove = c.y > padY + 16; // enough room above dot
            return (
              <g key={c.runId}>
                {/* Value label */}
                <text
                  x={c.x}
                  y={labelAbove ? c.y - 7 : c.y + 16}
                  fontSize={9}
                  textAnchor="middle"
                  fill="rgb(99,102,241)"
                  fontWeight="600"
                  fillOpacity={0.85}
                >
                  {c.rate.toFixed(0)}%
                </text>
                {/* Dot */}
                <circle cx={c.x} cy={c.y} r={4} fill="rgb(99,102,241)" stroke="white" strokeWidth={2} />
                {/* Date label (sparse) */}
                {i % step === 0 || i === runs.length - 1 ? (
                  <text
                    x={c.x}
                    y={padY + innerH + 18}
                    fontSize={8}
                    textAnchor={i === 0 ? "start" : i === runs.length - 1 ? "end" : "middle"}
                    fill="currentColor"
                    fillOpacity={0.4}
                  >
                    {new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}

// ── Run detail view ────────────────────────────────────────────────────────

function RunDetailView({
  run,
  onBack,
}: {
  run: GeoRunDetail;
  onBack: () => void;
}) {
  const [carouselIdx, setCarouselIdx] = useState<Record<number, number>>({});
  const [fullResponseOpen, setFullResponseOpen] = useState<{
    rowIndex: number;
    variantIndex: number;
  } | null>(null);

  const results = run.results ?? [];

  const overallCitationRate =
    results.length > 0
      ? Math.round(results.reduce((a, r) => a + (r.avgCitationRate ?? 0), 0) / results.length)
      : 0;

  const avgShareOfVoice =
    results.length > 0
      ? Math.round(
          (results.reduce((a, r) => a + (r.shareOfVoice ?? 0), 0) / results.length) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to history
        </Button>
      </div>

      {/* Run metadata */}
      <Card className="border-border bg-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(run.createdAt ?? "")}
            </span>
            {run.companyName && (
              <span className="flex items-center gap-1.5 font-medium">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                {run.companyName}
              </span>
            )}
            {run.mainUrl && (
              <span className="flex items-center gap-1.5 text-muted-foreground font-mono text-xs truncate max-w-[220px]">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                {run.mainUrl}
              </span>
            )}
            {run.targetLLMs && run.targetLLMs.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex gap-1">
                  {run.targetLLMs.map((llm) => (
                    <Badge key={llm} variant="outline" className="text-[10px] px-1.5 py-0">{llm}</Badge>
                  ))}
                </div>
              </span>
            )}
            {run.model && (
              <span className="text-xs text-muted-foreground">{run.model}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Overall Citation Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold",
              overallCitationRate >= 70 ? "text-emerald-600" : overallCitationRate >= 40 ? "text-amber-600" : "text-red-600"
            )}>
              {overallCitationRate}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">{results.length} prompt{results.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Avg Share of Voice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgShareOfVoice}%</p>
            <p className="text-xs text-muted-foreground mt-1">across all prompts</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Total Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {run.totalLatencyMs != null
                ? `${(run.totalLatencyMs / 1000).toFixed(1)}s`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCost(run.totalEstimatedCostUsd)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-prompt results */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Prompt Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No prompt results stored for this run.</p>
          ) : (
            <div className="space-y-6">
              {results.map((row, i) => {
                const idx = carouselIdx[i] ?? 0;
                const totalVariants = row.variantRuns?.length ?? 0;
                const variant = row.variantRuns?.[idx];

                return (
                  <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-4">
                    {/* Prompt text */}
                    <p className="font-medium text-foreground text-sm leading-snug">{row.prompt}</p>

                    {/* Core metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Cited</p>
                        {row.cited != null ? (
                          row.runs != null && row.runs > 1 && row.citedCount != null ? (
                            <span className="font-medium">{row.citedCount}/{row.runs}</span>
                          ) : row.cited ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Yes</Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )
                        ) : "—"}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Citation Rate</p>
                        <span className={cn(
                          "font-bold text-base",
                          (row.avgCitationRate ?? 0) >= 70 ? "text-emerald-600" : (row.avgCitationRate ?? 0) >= 40 ? "text-amber-600" : "text-red-600"
                        )}>
                          {row.avgCitationRate ?? 0}%
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Position</p>
                        <span className="capitalize text-sm">{positionLabel(row.answerPosition)}</span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Sources / SoV</p>
                        <span className="text-sm">
                          {row.sourceCount ?? 0} sources
                          {row.shareOfVoice != null && row.shareOfVoice > 0
                            ? ` · ${Math.round(row.shareOfVoice * 100)}% SoV`
                            : ""}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Confidence</p>
                        <Badge className={confidenceColor(row.confidenceScore)}>
                          {confidenceLabel(row.confidenceScore)}
                          {row.confidenceScore ? ` (${row.confidenceScore}/5)` : ""}
                        </Badge>
                      </div>
                    </div>

                    {/* Secondary metrics */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>Latency: {row.latencyMs != null ? `${(row.latencyMs / 1000).toFixed(1)}s` : "—"}</span>
                      <span>
                        Tokens:{" "}
                        {row.inputTokens != null && row.outputTokens != null
                          ? `${row.inputTokens + row.outputTokens}`
                          : "—"}
                      </span>
                      <span>Cost: {row.estimatedCostUsd != null ? `$${row.estimatedCostUsd.toFixed(4)}` : "—"}</span>
                      <span>Rank: {row.rank ?? "—"}</span>
                    </div>

                    {/* Sources found */}
                    {row.sourcesFound && row.sourcesFound.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Sources found ({row.sourcesFound.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {row.sourcesFound.map((s) => (
                            <Badge key={s} variant="outline" className="text-xs font-mono">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Competitor comparison */}
                    {row.competitorResults && row.competitorResults.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Competitor citations
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {row.competitorResults.map((c) => (
                            <Badge
                              key={c.name}
                              variant={c.cited ? "default" : "secondary"}
                              className={c.cited ? "bg-red-100 text-red-800" : ""}
                            >
                              {c.name}: {c.cited ? "Cited" : "Not cited"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Variant / repeat runs carousel */}
                    {totalVariants > 0 && variant && (
                      <div className="pt-3 border-t border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {row.mode === "repeat" ? "Runs" : "Similar prompts"} — {idx + 1} / {totalVariants}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => setCarouselIdx((prev) => ({ ...prev, [i]: idx - 1 }))}
                              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === totalVariants - 1}
                              onClick={() => setCarouselIdx((prev) => ({ ...prev, [i]: idx + 1 }))}
                              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFullResponseOpen({ rowIndex: i, variantIndex: idx })}
                          className="w-full rounded-md border border-border bg-muted/20 p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <p className="font-medium text-foreground mb-1">&quot;{variant.prompt}&quot;</p>
                          <p className="text-muted-foreground text-xs leading-relaxed mb-2 line-clamp-3">
                            {variant.snippet}
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge
                              variant={variant.cited ? "default" : "secondary"}
                              className={variant.cited ? "bg-emerald-100 text-emerald-800" : ""}
                            >
                              {variant.cited ? "Cited" : "Not cited"}
                            </Badge>
                            {variant.citationTag && (
                              <Badge variant="outline" className="text-xs font-normal">{variant.citationTag}</Badge>
                            )}
                            <span className="text-xs text-muted-foreground capitalize">
                              {positionLabel(variant.answerPosition)}
                            </span>
                            {variant.confidenceScore != null && variant.confidenceScore > 0 && (
                              <Badge className={cn("text-xs", confidenceColor(variant.confidenceScore))}>
                                {confidenceLabel(variant.confidenceScore)}
                              </Badge>
                            )}
                            {variant.sourcesFound && variant.sourcesFound.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {variant.sourcesFound.length} sources
                              </span>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                              <Maximize2 className="h-3 w-3" /> Full response
                            </span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full response dialog */}
      <Dialog
        open={!!fullResponseOpen}
        onOpenChange={(open) => !open && setFullResponseOpen(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Full response</DialogTitle>
            <DialogDescription>
              Complete model output for this run.
            </DialogDescription>
          </DialogHeader>
          {fullResponseOpen != null && (() => {
            const v = results[fullResponseOpen.rowIndex]?.variantRuns?.[fullResponseOpen.variantIndex];
            if (!v) return null;
            const fullText = v.fullResponse ?? v.snippet;
            return (
              <>
                <p className="text-sm font-medium text-foreground">&quot;{v.prompt}&quot;</p>
                <div className="rounded-md border border-border bg-muted/30 p-4 overflow-y-auto max-h-[50vh] text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {fullText}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={v.cited ? "default" : "secondary"}
                    className={v.cited ? "bg-emerald-100 text-emerald-800 w-fit" : "w-fit"}
                  >
                    {v.cited ? "Cited" : "Not cited"}
                  </Badge>
                  {v.citationTag && (
                    <Badge variant="outline" className="text-xs font-normal w-fit">{v.citationTag}</Badge>
                  )}
                  {v.answerPosition && (
                    <span className="text-xs text-muted-foreground capitalize">
                      Position: {positionLabel(v.answerPosition)}
                    </span>
                  )}
                  {v.confidenceScore != null && v.confidenceScore > 0 && (
                    <Badge className={cn("text-xs", confidenceColor(v.confidenceScore))}>
                      Recommendation: {confidenceLabel(v.confidenceScore)} ({v.confidenceScore}/5)
                    </Badge>
                  )}
                </div>
                {v.sourcesFound && v.sourcesFound.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {v.sourcesFound.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs font-mono">{s}</Badge>
                    ))}
                  </div>
                )}
                {v.competitorResults && v.competitorResults.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {v.competitorResults.map((c) => (
                      <Badge
                        key={c.name}
                        variant={c.cited ? "default" : "secondary"}
                        className={c.cited ? "bg-red-100 text-red-800" : ""}
                      >
                        {c.name}: {c.cited ? "Cited" : "Not cited"}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function GeoHistoryPanel({ companyName }: { companyName?: string }) {
  const [runs, setRuns] = useState<GeoRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<GeoRunDetail | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "20" });
    if (companyName) params.set("company", companyName);
    fetch(`/api/geo/history?${params.toString()}`)
      .then((res) => res.json())
      .then((data: HistoryResponse & { error?: string }) => {
        if (data.runs && data.runs.length > 0) {
          setRuns(data.runs);
        } else if (data.error) {
          setError(data.error);
        }
      })
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, [companyName]);

  const openRun = async (runId: string) => {
    setLoadingRun(true);
    try {
      const res = await fetch(`/api/geo/history?runId=${encodeURIComponent(runId)}`);
      const data = (await res.json()) as RunDetailResponse & { error?: string };
      if (data.run) {
        setSelectedRun(data.run);
      }
    } catch {
      // swallow — stay on list
    } finally {
      setLoadingRun(false);
    }
  };

  // Reverse for chart (oldest first)
  const chronological = [...runs].reverse();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading AI Echo history…
      </div>
    );
  }

  if (error || runs.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <History className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-slate-700">No AI Echo history yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Run an AI Echo benchmark to start tracking citation rate over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Drill-down: show detail view
  if (selectedRun) {
    return <RunDetailView run={selectedRun} onBack={() => setSelectedRun(null)} />;
  }

  // List view
  return (
    <div className="space-y-6">
      <CitationTrendChart runs={chronological} />

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Recent Runs
            <Badge variant="secondary" className="ml-auto">
              {runs.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRun && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading run details…
            </div>
          )}
          {!loadingRun && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Prompts</TableHead>
                  <TableHead>LLMs</TableHead>
                  <TableHead className="text-right">Avg Citation %</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.runId}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => openRun(run.runId)}
                  >
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(run.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {run.companyName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.prompts.length} prompt{run.prompts.length !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(run.targetLLMs ?? ["gpt"]).map((llm) => (
                          <Badge key={llm} variant="outline" className="text-[10px] px-1.5 py-0">
                            {llm}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "text-sm font-bold",
                          run.avgCitationRate >= 70
                            ? "text-emerald-600"
                            : run.avgCitationRate >= 40
                            ? "text-amber-600"
                            : "text-red-600"
                        )}
                      >
                        {run.avgCitationRate.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatCost(run.totalEstimatedCostUsd)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {run.totalLatencyMs != null
                        ? `${(run.totalLatencyMs / 1000).toFixed(1)}s`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Click any row to view the full prompt-by-prompt breakdown.
      </p>
    </div>
  );
}

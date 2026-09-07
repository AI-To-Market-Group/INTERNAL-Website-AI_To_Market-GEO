"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, DollarSign, Zap, BarChart2, RefreshCw } from "lucide-react";

interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedUsd: number;
  totalCalls: number;
  byFeature: { feature: string; calls: number; estimatedUsd: number; tokens: number }[];
  byDay: { date: string; estimatedUsd: number; calls: number }[];
  setupRequired?: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  "content-forge/create":    "Content Forge — Create",
  "content-forge/blog":      "Content Forge — Blog",
  "content-forge/linkedin":  "Content Forge — LinkedIn",
  "illustration":            "Illustration Generation",
  "article-outline":         "Article Outline",
  "article-draft":           "Article Draft",
  "article-refine":          "Article Refine",
  "article-chat":            "Article Builder Chat",
  "article-section-revise":  "Section Revision",
  "article-selection-rewrite":"Selection Rewrite",
  "geo-metadata":            "GEO Metadata",
  "geo-fix":                 "GEO Fix",
  "ai-suggest":              "AI Suggest",
  "identity-analysis":       "Identity Analysis",
  "opportunity-generate":    "Opportunity Generation",
};

function fmt(usd: number) {
  return usd < 0.01 ? "<$0.01" : `$${usd.toFixed(4)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function DailyChart({ byDay }: { byDay: { date: string; estimatedUsd: number }[] }) {
  if (!byDay.length) return null;
  const max = Math.max(...byDay.map((d) => d.estimatedUsd), 0.0001);

  return (
    <div className="flex items-end gap-1 h-20 w-full">
      {byDay.map((d) => {
        const pct = (d.estimatedUsd / max) * 100;
        const label = d.date.slice(5); // MM-DD
        return (
          <div key={d.date} className="flex flex-col items-center flex-1 gap-1 group relative">
            <div
              className="w-full rounded-sm transition-all duration-300 bar-fill"
              style={{ height: `${Math.max(pct, 2)}%` }}
              title={`${label}: ${fmt(d.estimatedUsd)}`}
            />
            {byDay.length <= 10 && (
              <span className="text-[9px] text-muted-foreground leading-none tabular-nums">{label}</span>
            )}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
              {label}: {fmt(d.estimatedUsd)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UsageClient() {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  async function load(d: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usage?days=${d}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as UsageSummary;
      setData(json);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(days); }, [days]);

  const totalTokens = data ? data.totalInputTokens + data.totalOutputTokens : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Usage</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Token consumption and estimated cost across all features
          </p>
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              Last refreshed:{" "}
              {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}{" "}
              · {lastRefreshed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => load(days)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading usage data…
        </div>
      )}

      {data && (
        <>
              {/* Stat tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums tracking-tight">
                  ${data.totalEstimatedUsd.toFixed(4)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">last {days} days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums tracking-tight">
                  {fmtTokens(totalTokens)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtTokens(data.totalInputTokens)} in · {fmtTokens(data.totalOutputTokens)} out
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">API Calls</CardTitle>
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums tracking-tight">
                  {data.totalCalls.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">logged requests</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily chart */}
          {data.byDay.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Daily Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <style>{`.bar-fill { background: hsl(var(--primary)); opacity: 0.75; }`}</style>
                <DailyChart byDay={data.byDay} />
              </CardContent>
            </Card>
          )}

          {/* Feature breakdown */}
          {data.byFeature.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Cost by Feature</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead className="text-right tabular-nums">Calls</TableHead>
                      <TableHead className="text-right tabular-nums">Tokens</TableHead>
                      <TableHead className="text-right tabular-nums">Est. Cost</TableHead>
                      <TableHead className="w-32">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byFeature.map((f) => {
                      const share = data.totalEstimatedUsd > 0
                        ? (f.estimatedUsd / data.totalEstimatedUsd) * 100
                        : 0;
                      return (
                        <TableRow key={f.feature}>
                          <TableCell className="font-medium text-sm">
                            {FEATURE_LABELS[f.feature] ?? f.feature}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                            {f.calls}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                            {fmtTokens(f.tokens)}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums font-medium">
                            {fmt(f.estimatedUsd)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary opacity-70"
                                  style={{ width: `${share.toFixed(1)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                                {share.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No usage recorded in the last {days} days.
                <br />
                Usage is tracked automatically once you start using AI features.
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground text-center pb-2">
            Cost estimates use OpenAI list pricing. Token counts are exact values returned by the API.
            Verify totals at{" "}
            <a
              href="https://platform.openai.com/usage"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              platform.openai.com/usage
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}

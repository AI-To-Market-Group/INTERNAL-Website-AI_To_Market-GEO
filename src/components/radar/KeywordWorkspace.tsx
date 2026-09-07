"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ArrowRight, Loader2, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CONTENT_THEME_IDS } from "@/types";

interface GSCQuery { query: string; clicks: number; impressions: number; position: number; }

const SEEDED_KEYWORDS = [
  // Core positioning
  "generative engine optimization",
  "AI go-to-market strategy",
  "AI-first content marketing",
  "LLM-optimized content",
  "GEO vs SEO",
  // ICP pain points — enterprise revenue teams
  "B2B AI demand generation",
  "AI-powered ABM",
  "revenue operations AI",
  "AI sales enablement",
  "enterprise AI adoption",
  // Service-specific
  "AI content at scale",
  "agentic marketing automation",
  "B2B AI consulting",
  "AI marketing ROI",
  "AI agent for enterprise sales",
  // Audience segments
  "CMO AI strategy",
  "AI for SaaS go-to-market",
  "enterprise LLM deployment",
  "AI SDR vs human SDR",
  "AI-first growth strategy",
];

const ADMIN_EMAILS = new Set(["neha@aitomarketgroup.com", "manoj@aitomarketgroup.com"]);

interface KeywordWorkspaceProps {
  /** Seed keywords from user settings — fallback when GSC is not connected */
  seedKeywords: string[];
}

export function KeywordWorkspace({ seedKeywords }: KeywordWorkspaceProps) {
  const queryClient = useQueryClient();

  // ── Panel state ──────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(true);

  // ── Current user (for admin gate) ────────────────────────────────────────────
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then((d: { email?: string } | null) => { if (d?.email) setUserEmail(d.email); })
      .catch(() => {});
  }, []);

  // ── Search Console ───────────────────────────────────────────────────────────
  const [gscQueries, setGscQueries]     = useState<GSCQuery[]>([]);
  const [gscConnected, setGscConnected] = useState<boolean | null>(null); // null = loading
  const [gscSiteUrl, setGscSiteUrl]     = useState("");

  useEffect(() => {
    fetch("/api/gsc/top-queries")
      .then((r) => r.ok ? r.json() : { connected: false, queries: [] })
      .then((data: { connected: boolean; queries?: GSCQuery[]; siteUrl?: string }) => {
        setGscConnected(data.connected);
        setGscQueries(data.queries ?? []);
        setGscSiteUrl(data.siteUrl ?? "");
      })
      .catch(() => setGscConnected(false));
  }, []);

  // ── AI Echo prompts (from GEO run history) ───────────────────────────────────
  const [echoKeywords, setEchoKeywords] = useState<string[]>([]);
  const [echoLoading, setEchoLoading] = useState(true);

  useEffect(() => {
    fetch("/api/geo/history?limit=30")
      .then((r) => (r.ok ? r.json() : { runs: [] }))
      .then((data: { runs?: { prompts?: string[] }[] }) => {
        const runs = data.runs ?? [];
        const seen = new Set<string>();
        const prompts: string[] = [];
        for (const run of runs) {
          for (const p of run.prompts ?? []) {
            if (p && !seen.has(p)) { seen.add(p); prompts.push(p); }
          }
        }
        setEchoKeywords(prompts.slice(0, 25));
      })
      .catch(() => setEchoKeywords([]))
      .finally(() => setEchoLoading(false));
  }, []);

  // ── Custom keywords ──────────────────────────────────────────────────────────
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");

  const addCustom = useCallback(() => {
    const kw = customInput.trim();
    if (!kw) return;
    setCustomKeywords((prev) => (prev.includes(kw) ? prev : [...prev, kw]));
    setCustomInput("");
  }, [customInput]);

  // ── Selection ────────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleChip = useCallback((kw: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw); else next.add(kw);
      return next;
    });
  }, []);

  const removeFromTray = useCallback((kw: string) => {
    setSelected((prev) => { const next = new Set(prev); next.delete(kw); return next; });
  }, []);

  // ── Instruction ──────────────────────────────────────────────────────────────
  const [instruction, setInstruction] = useState("");

  // ── Combine dialog ───────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openDialog = useCallback(() => setDialogOpen(true), []);

  const handleCreate = useCallback(async () => {
    const arr = [...selected];
    const placeholder = arr.slice(0, 3).join(" · ");

    // Standard context block that helps any LLM understand what to build
    const standardContext = [
      "CONTENT CONTEXT",
      "Brand: AI To Market — a B2B AI consultancy helping enterprise revenue teams (CMOs, VP Sales, RevOps leaders) adopt AI across their go-to-market motion.",
      "Audience: Decision-makers at mid-market to enterprise B2B SaaS and services companies who are evaluating or scaling AI adoption.",
      "Content goal: Build authoritative, GEO-optimised thought leadership that ranks in both traditional search and is cited by LLMs (ChatGPT, Perplexity, Claude). Depth and specificity beat generic overviews — the reader should leave knowing exactly what to do next.",
      `Keyword cluster: ${arr.join(", ")}`,
      "Use the keyword cluster to determine the core topic, map search intent (awareness / consideration / decision), and ensure the outline covers the angle a senior B2B buyer would actually find useful.",
    ].join("\n");

    const additionalInstructions = instruction.trim();
    const content_brief = additionalInstructions
      ? `${standardContext}\n\nADDITIONAL INSTRUCTIONS\n${additionalInstructions}`
      : standardContext;

    setSaving(true);
    try {
      const res = await fetch("/api/opportunities/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: placeholder,
          type: "SEO_GAP",
          score: 50,
          theme: CONTENT_THEME_IDS[0],
          content_brief,
          tags: arr,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Opportunity created — open it to pick a title.");
      setDialogOpen(false);
      setSelected(new Set());
      setInstruction("");
    } catch {
      toast.error("Failed to create opportunity.");
    } finally {
      setSaving(false);
    }
  }, [instruction, selected, queryClient]);

  const selectedArr = [...selected];
  const hasSelection = selectedArr.length > 0;
  const canCombine = selectedArr.length >= 2;

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-2.5">
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
            New
          </span>
          <h2 className="text-sm font-semibold text-slate-900">Keyword Workspace</h2>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          {/* ── Four columns ── */}
          <div className="grid grid-cols-4 gap-3 border-t border-slate-100 p-4">

            {/* Search Console */}
            {gscConnected === false ? (
              <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200">
                <ColHeader title="Search Console" subtitle="Not connected" count={0} />
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5 min-h-[150px]">
                  {ADMIN_EMAILS.has(userEmail) ? (
                    <>
                      <p className="text-center text-xs text-slate-400 leading-relaxed">
                        Connect Google Search Console once to pull real queries for your whole team.
                      </p>
                      <a
                        href="/api/auth/gsc/start?returnTo=/atelier"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Connect GSC
                      </a>
                    </>
                  ) : (
                    <p className="text-center text-xs text-slate-400 leading-relaxed">
                      Search Console not connected yet — ask your admin to connect it. Showing seed keywords in the meantime.
                    </p>
                  )}
                </div>
                {seedKeywords.length > 0 && (
                  <div className="flex flex-wrap content-start gap-1.5 overflow-y-auto border-t border-slate-100 p-3 max-h-[120px]">
                    {seedKeywords.map((kw) => (
                      <Chip key={kw} kw={kw} selected={selected.has(kw)} onToggle={toggleChip} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Search Console</div>
                    <div className="text-[10px] text-slate-400">
                      {gscConnected === null ? "Loading…" : (gscSiteUrl || "aitomarketgroup.com")} · top 30 queries
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                    {gscConnected === null ? "…" : gscQueries.length}
                  </span>
                </div>
                <div className="flex min-h-[120px] max-h-[220px] flex-wrap content-start gap-1.5 overflow-y-auto p-3">
                  {gscConnected === null ? (
                    <span className="text-[11px] italic text-slate-400">Loading…</span>
                  ) : gscQueries.length === 0 ? (
                    <span className="text-[11px] italic text-slate-400">No data yet — GSC may take 48 h to populate.</span>
                  ) : (
                    gscQueries.map(({ query }) => (
                      <Chip key={query} kw={query} selected={selected.has(query)} onToggle={toggleChip} />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* AI Echo */}
            <KeywordColumn
              title="AI Echo"
              subtitle="Past GEO benchmark prompts"
              keywords={echoKeywords}
              selected={selected}
              onToggle={toggleChip}
              loading={echoLoading}
              emptyMessage="No history yet — run a GEO check in AI Echo."
            />

            {/* Seeded */}
            <KeywordColumn
              title="Seeded"
              subtitle="ICP-rooted starting points"
              keywords={SEEDED_KEYWORDS}
              selected={selected}
              onToggle={toggleChip}
              loading={false}
              emptyMessage=""
            />

            {/* Custom */}
            <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200">
              <ColHeader title="Custom" subtitle="Add your own" count={customKeywords.length} />
              <div className="flex min-h-[120px] max-h-[220px] flex-wrap content-start gap-1.5 overflow-y-auto p-3">
                {customKeywords.map((kw) => (
                  <Chip key={kw} kw={kw} selected={selected.has(kw)} onToggle={toggleChip} />
                ))}
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addCustom(); }
                  }}
                  placeholder="Type a keyword…"
                  className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Add
                </button>
              </div>
            </div>

          </div>

          {/* ── Selected tray ── */}
          <div className="flex flex-col gap-2.5 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Selected
              </span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {hasSelection ? (
                  selectedArr.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-50"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeFromTray(kw)}
                        className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-red-500"
                        aria-label={`Remove ${kw}`}
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs italic text-slate-400">
                    No keywords selected — click chips above to add them here
                  </span>
                )}
              </div>
              {canCombine && (
                <button
                  type="button"
                  onClick={openDialog}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Combine into topic
                </button>
              )}
            </div>

            {/* Instruction textarea — visible when anything selected */}
            {hasSelection && (
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Additional instructions — e.g. BOFU intent, comparison angle, focus on RevOps persona…"
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400"
              />
            )}
          </div>
        </>
      )}

      {/* ── Combine dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Combine into a topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-slate-500">
              An opportunity card will be created with these keywords. You&apos;ll pick a title from AI suggestions in the next step.
            </p>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Keywords attached
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectedArr.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-50"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            {instruction.trim() && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Additional Instructions
                </label>
                <p className="text-xs text-slate-600 italic">{instruction.trim()}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create opportunity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ColHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</div>
        <div className="text-[10px] text-slate-400">{subtitle}</div>
      </div>
      <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
        {count}
      </span>
    </div>
  );
}

function Chip({
  kw,
  selected,
  onToggle,
}: {
  kw: string;
  selected: boolean;
  onToggle: (kw: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(kw)}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        selected
          ? "border-transparent bg-slate-900 text-slate-50"
          : "border-transparent bg-slate-100 text-slate-600 hover:border-slate-300"
      )}
    >
      {kw}
    </button>
  );
}

interface KeywordColumnProps {
  title: string;
  subtitle: string;
  keywords: string[];
  selected: Set<string>;
  onToggle: (kw: string) => void;
  loading?: boolean;
  emptyMessage?: string;
}

function KeywordColumn({
  title,
  subtitle,
  keywords,
  selected,
  onToggle,
  loading,
  emptyMessage,
}: KeywordColumnProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200">
      <ColHeader title={title} subtitle={subtitle} count={keywords.length} />
      <div className="flex min-h-[120px] max-h-[220px] flex-wrap content-start gap-1.5 overflow-y-auto p-3">
        {loading ? (
          <span className="text-[11px] italic text-slate-400">Loading…</span>
        ) : keywords.length === 0 ? (
          <span className="text-[11px] italic text-slate-400">{emptyMessage}</span>
        ) : (
          keywords.map((kw) => (
            <Chip key={kw} kw={kw} selected={selected.has(kw)} onToggle={onToggle} />
          ))
        )}
      </div>
    </div>
  );
}

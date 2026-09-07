"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, X, ExternalLink, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CONTENT_THEME_IDS } from "@/types";

// ── Palette (matches v2) ──────────────────────────────────────────────────────
const C = {
  dark:   "#163D26",
  mid:    "#185F00",
  bg:     "#F7F5F2",
  white:  "#FFFFFF",
  border: "rgba(22,61,38,.12)",
  faint:  "rgba(22,61,38,.06)",
  muted:  "rgba(22,61,38,.55)",
};

interface GSCQuery { query: string; clicks: number; impressions: number; position: number; }

const SEEDED_KEYWORDS = [
  "generative engine optimization",
  "AI go-to-market strategy",
  "AI-first content marketing",
  "LLM-optimized content",
  "GEO vs SEO",
  "B2B AI demand generation",
  "AI-powered ABM",
  "revenue operations AI",
  "AI sales enablement",
  "enterprise AI adoption",
  "AI content at scale",
  "agentic marketing automation",
  "B2B AI consulting",
  "AI marketing ROI",
  "AI agent for enterprise sales",
  "CMO AI strategy",
  "AI for SaaS go-to-market",
  "enterprise LLM deployment",
  "AI SDR vs human SDR",
  "AI-first growth strategy",
];

const ADMIN_EMAILS = new Set(["neha@aitomarketgroup.com", "manoj@aitomarketgroup.com"]);

interface KeywordWorkspaceProps {
  seedKeywords: string[];
}

export function KeywordWorkspace({ seedKeywords }: KeywordWorkspaceProps) {
  const [userEmail, setUserEmail] = useState<string>("");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);

  // ── Search Console ──────────────────────────────────────────────────────────
  const [gscQueries, setGscQueries]     = useState<GSCQuery[]>([]);
  const [gscConnected, setGscConnected] = useState<boolean | null>(null);
  const [gscSiteUrl, setGscSiteUrl]     = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { email?: string } | null) => { if (d?.email) setUserEmail(d.email); })
      .catch(() => {});
  }, []);

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

  // ── AI Echo ─────────────────────────────────────────────────────────────────
  const [echoKeywords, setEchoKeywords] = useState<string[]>([]);
  const [echoLoading, setEchoLoading]   = useState(true);

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

  // ── Custom ──────────────────────────────────────────────────────────────────
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [customInput, setCustomInput]       = useState("");

  const addCustom = useCallback(() => {
    const kw = customInput.trim();
    if (!kw) return;
    setCustomKeywords((prev) => (prev.includes(kw) ? prev : [...prev, kw]));
    setCustomInput("");
  }, [customInput]);

  // ── Selection ───────────────────────────────────────────────────────────────
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

  const [instruction, setInstruction] = useState("");

  // ── Dialog ──────────────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving]         = useState(false);

  const handleCreate = useCallback(async () => {
    const arr = [...selected];
    const placeholder = arr.slice(0, 3).join(" · ");

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
        body: JSON.stringify({ title: placeholder, type: "SEO_GAP", score: 50, theme: CONTENT_THEME_IDS[0], content_brief, tags: arr }),
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

  const selectedArr  = [...selected];
  const hasSelection = selectedArr.length > 0;
  const canCombine   = selectedArr.length >= 2;

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, overflow: "hidden" }}>

      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", padding: "3px 8px", borderRadius: 5, background: "rgba(24,95,0,.1)", color: C.mid }}>NEW</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>Keyword Workspace</span>
        </div>
        <ChevronUp style={{ width: 16, height: 16, color: C.muted, transform: open ? "rotate(0deg)" : "rotate(180deg)", transition: "transform .2s" }} />
      </button>

      {open && (
        <>
          {/* Four columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, padding: "0 20px 20px", borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>

            {/* Search Console */}
            {gscConnected === false ? (
              <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                <ColHeader title="SEARCH CONSOLE" subtitle="Not connected" count={0} />
                <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, minHeight: 150 }}>
                  {ADMIN_EMAILS.has(userEmail) ? (
                    <>
                      <p style={{ textAlign: "center", fontSize: 11, fontWeight: 400, lineHeight: 1.55, color: C.muted }}>
                        Connect Google Search Console once to pull real queries for your whole team.
                      </p>
                      <a
                        href="/api/auth/gsc/start?returnTo=/atelier-v2"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                      >
                        <ExternalLink style={{ width: 12, height: 12 }} />
                        Connect GSC
                      </a>
                    </>
                  ) : (
                    <p style={{ textAlign: "center", fontSize: 11, fontWeight: 400, lineHeight: 1.55, color: C.muted }}>
                      Search Console not connected yet — ask your admin to connect it. Using seed keywords in the meantime.
                    </p>
                  )}
                </div>
                {seedKeywords.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "12px 14px", borderTop: `1px solid ${C.border}`, maxHeight: 120, overflowY: "auto" }}>
                    {seedKeywords.map((kw) => (
                      <Chip key={kw} kw={kw} selected={selected.has(kw)} onToggle={toggleChip} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: C.mid }}>SEARCH CONSOLE</div>
                    <div style={{ fontSize: 10, fontWeight: 400, color: C.muted, marginTop: 2 }}>
                      {gscConnected === null ? "Loading…" : (gscSiteUrl || "aitomarketgroup.com")} · top 30 queries
                    </div>
                  </div>
                  <CountBadge n={gscConnected === null ? "…" : gscQueries.length} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 6, padding: 14, minHeight: 120, maxHeight: 220, overflowY: "auto" }}>
                  {gscConnected === null ? (
                    <span style={{ fontSize: 11, fontStyle: "italic", color: C.muted }}>Loading…</span>
                  ) : gscQueries.length === 0 ? (
                    <span style={{ fontSize: 11, fontStyle: "italic", color: C.muted }}>No data yet — GSC may take 48 h to populate.</span>
                  ) : (
                    gscQueries.map(({ query }) => (
                      <Chip key={query} kw={query} selected={selected.has(query)} onToggle={toggleChip} />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* AI Echo */}
            <KeywordColumn title="AI ECHO" subtitle="Past GEO benchmark prompts" keywords={echoKeywords} selected={selected} onToggle={toggleChip} loading={echoLoading} emptyMessage="No history yet — run a GEO check in AI Echo." />

            {/* Seeded */}
            <KeywordColumn title="SEEDED" subtitle="ICP-rooted starting points" keywords={SEEDED_KEYWORDS} selected={selected} onToggle={toggleChip} loading={false} emptyMessage="" />

            {/* Custom */}
            <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
              <ColHeader title="CUSTOM" subtitle="Add your own" count={customKeywords.length} />
              <div style={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 6, padding: 14, flex: 1, overflowY: "auto" }}>
                {customKeywords.map((kw) => (
                  <Chip key={kw} kw={kw} selected={selected.has(kw)} onToggle={toggleChip} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                  placeholder="Type a keyword…"
                  style={{ flex: 1, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 400, color: C.dark, background: C.bg, outline: "none", fontFamily: "inherit" }}
                />
                <button
                  type="button"
                  onClick={addCustom}
                  style={{ padding: "8px 14px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Add
                </button>
              </div>
            </div>

          </div>

          {/* Selected tray */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 20px", borderTop: `1px solid ${C.border}`, background: C.bg }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: C.muted }}>SELECTED</span>
              <div style={{ display: "flex", flex: 1, flexWrap: "wrap", gap: 6 }}>
                {hasSelection ? (
                  selectedArr.map((kw) => (
                    <span key={kw} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, background: C.dark, color: C.white, fontSize: 11, fontWeight: 600 }}>
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeFromTray(kw)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", padding: 0 }}
                        aria-label={`Remove ${kw}`}
                      >
                        <X style={{ width: 8, height: 8, color: C.white }} />
                      </button>
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, fontStyle: "italic", color: C.muted }}>No keywords selected — click chips above to add them here</span>
                )}
              </div>
              {canCombine && (
                <button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  style={{ display: "inline-flex", flexShrink: 0, alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  <ArrowRight style={{ width: 13, height: 13 }} />
                  Combine into topic
                </button>
              )}
            </div>

            {hasSelection && (
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Additional instructions — e.g. BOFU intent, comparison angle, focus on RevOps persona…"
                rows={2}
                style={{ width: "100%", resize: "none", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 400, color: C.dark, background: C.white, outline: "none", fontFamily: "inherit", lineHeight: 1.55 }}
              />
            )}
          </div>
        </>
      )}

      {/* Combine dialog */}
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
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Keywords attached</label>
              <div className="flex flex-wrap gap-1.5">
                {selectedArr.map((kw) => (
                  <span key={kw} style={{ display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 20, background: C.dark, color: C.white, fontSize: 11, fontWeight: 600 }}>{kw}</span>
                ))}
              </div>
            </div>
            {instruction.trim() && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Additional Instructions</label>
                <p className="text-xs text-slate-600 italic">{instruction.trim()}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} style={{ background: C.dark }}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create opportunity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function CountBadge({ n }: { n: number | string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(22,61,38,.1)", color: C.dark }}>{n}</span>
  );
}

function ColHeader({ title, subtitle, count }: { title: string; subtitle: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: C.mid }}>{title}</div>
        <div style={{ fontSize: 10, fontWeight: 400, color: C.muted, marginTop: 2 }}>{subtitle}</div>
      </div>
      <CountBadge n={count} />
    </div>
  );
}

function Chip({ kw, selected, onToggle }: { kw: string; selected: boolean; onToggle: (kw: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(kw)}
      style={{
        display: "inline-flex", alignItems: "center", padding: "6px 11px", borderRadius: 20,
        fontSize: 11, fontWeight: 600, border: `1px solid ${selected ? C.dark : "rgba(22,61,38,.18)"}`,
        background: selected ? C.dark : "rgba(22,61,38,.05)",
        color: selected ? C.white : C.dark,
        cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
      }}
    >
      {kw}
    </button>
  );
}

interface KeywordColumnProps {
  title: string; subtitle: string; keywords: string[];
  selected: Set<string>; onToggle: (kw: string) => void;
  loading?: boolean; emptyMessage?: string;
}

function KeywordColumn({ title, subtitle, keywords, selected, onToggle, loading, emptyMessage }: KeywordColumnProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
      <ColHeader title={title} subtitle={subtitle} count={keywords.length} />
      <div style={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 6, padding: 14, minHeight: 120, maxHeight: 220, overflowY: "auto" }}>
        {loading ? (
          <span style={{ fontSize: 11, fontStyle: "italic", color: C.muted }}>Loading…</span>
        ) : keywords.length === 0 ? (
          <span style={{ fontSize: 11, fontStyle: "italic", color: C.muted }}>{emptyMessage}</span>
        ) : (
          keywords.map((kw) => (
            <Chip key={kw} kw={kw} selected={selected.has(kw)} onToggle={onToggle} />
          ))
        )}
      </div>
    </div>
  );
}

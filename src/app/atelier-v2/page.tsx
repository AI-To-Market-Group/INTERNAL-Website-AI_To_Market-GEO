"use client";

import { useState, useEffect, useRef } from "react";
import { KeywordWorkspace } from "./components/KeywordWorkspace";
import { useSettings } from "@/hooks/useSettings";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "dashboard" | "generate" | "queue" | "editor" | "score" | "keywords" | "publish" | "analytics" | "settings" | "usage" | "trash";
type FlowMode = "wizard" | "single" | "chat" | "keywords";
type VizMode = "ring" | "bars" | "grid";
type DataState = "normal" | "empty" | "loading";

interface BriefFields {
  client?: string;
  prompt?: string;
  format?: string;
  voice?: string;
  predictedScore?: string;
}

interface DraftCard {
  opportunityId: string;
  brief: BriefFields;
  createdAt: string;
}

interface V2OutlineSection {
  order: number;
  type: string;
  title: string;
  description: string[];
  keywords: string[];
}

interface SavedPlan {
  opportunityId: string;
  articleTitle: string;
  outline: V2OutlineSection[];
  brief: BriefFields;
  savedAt: string;
}

const SAVED_PLANS_KEY = "v2_saved_plans";

function readSavedPlans(): SavedPlan[] {
  try { return JSON.parse(localStorage.getItem(SAVED_PLANS_KEY) ?? "[]") as SavedPlan[]; }
  catch { return []; }
}
function writeSavedPlans(plans: SavedPlan[]) {
  try { localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(plans)); }
  catch {}
}

// ─── Palette constants ────────────────────────────────────────────────────────

const C = {
  dark:    "#163D26",
  mid:     "#185F00",
  bg:      "#F7F5F2",
  red:     "#F93943",
  salmon:  "#F88379",
  white:   "#FFFFFF",
  border:  "rgba(22,61,38,.12)",
  muted:   "rgba(22,61,38,.7)",
  faint:   "rgba(22,61,38,.06)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(v: number) {
  return v >= 80 ? C.dark : v >= 70 ? C.mid : C.red;
}

function creditBarColor(pct: number): string {
  if (pct >= 100) return C.red;
  if (pct >= 80) return "#F5A623";
  return C.salmon;
}

// ─── Nav definition ───────────────────────────────────────────────────────────

const NAV_ITEMS: [Screen, string, string, string][] = [
  ["dashboard",  "Overview",      "M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z", ""],
  ["generate",   "New article",   "M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8z", ""],
  ["queue",      "Batch queue",   "M3 4h14v2H3zM3 9h14v2H3zM3 14h10v2H3z", "12"],
  ["editor",     "Draft editor",  "M4 3h8l4 4v10H4z", ""],
  ["score",      "GEO score",     "M10 2a8 8 0 108 8h-8z", ""],
  ["keywords",   "Prompt library","M2 8l6-6h8v8l-6 6zM12 5h2v2h-2z", ""],
  ["publish",    "Publishing",    "M10 2l5 6h-3v6H8V8H5zM4 16h12v2H4z", ""],
  ["analytics",  "Visibility",    "M3 15h3V8H3zM8 15h3V3H8zM13 15h3v-7h-3z", ""],
  ["settings",   "Brand voice",   "M10 6a4 4 0 100 8 4 4 0 000-8zM9 2h2v3H9zM9 15h2v3H9zM2 9h3v2H2zM15 9h3v2h-3z", ""],
  ["trash",      "Trash",         "M7 3h6v2H7zM3 5h14v2H3zM5 7h10l-1 10H6L5 7z", ""],
];

const SCREEN_HEAD: Record<Screen, [string, string, string]> = {
  dashboard:  ["OVERVIEW",       "Answer engine visibility",          "How often the engines quote you, and what to write next."],
  generate:   ["CREATE",         "New GEO article",                   "Start from a prompt buyers actually type. We build the brief, draft and score in one run."],
  queue:      ["PRODUCTION",     "Batch queue",                       "Twelve prompts drafting, scoring and staging in parallel."],
  editor:     ["DRAFT",          "What is generative engine optimization?", "Edit alongside live scoring. Accept a suggestion and the score moves."],
  score:      ["DIAGNOSTIC",     "GEO score and recommendations",     "Where this draft wins a citation, and where it loses one."],
  keywords:   ["LIBRARY",        "Prompts and clusters",              "The question set we are trying to own for this client."],
  publish:    ["DISTRIBUTION",   "Publishing and integrations",       "Where approved drafts go, and what gets injected on the way out."],
  analytics:  ["MEASUREMENT",    "Visibility tracking",               "Citations, answer share and which drafts earn them."],
  settings:   ["CONFIGURATION",  "Brand voice",                       "Every generation inherits these rules. Change them once."],
  usage:      ["USAGE",          "AI spend & token usage",            "Token consumption and estimated cost across all features."],
  trash:      ["TRASH",          "Deleted briefs",                    "Removed cards. Restore them to the editor or delete permanently."],
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
      <rect x="2" y="4" width="16" height="2" rx="1" />
      <rect x="2" y="9" width="16" height="2" rx="1" />
      <rect x="2" y="14" width="16" height="2" rx="1" />
    </svg>
  );
}

function Sidebar({ screen, setScreen, collapsed, onToggle, creditPct, creditLabel, onUsageClick }: {
  screen: Screen; setScreen: (s: Screen) => void;
  collapsed: boolean; onToggle: () => void;
  creditPct: number; creditLabel: string;
  onUsageClick: () => void;
}) {
  const w = collapsed ? 64 : 248;
  const [showVersionMenu, setShowVersionMenu] = useState(false);

  return (
    <aside style={{ width: w, flexShrink: 0, background: C.dark, color: C.white, display: "flex", flexDirection: "column", padding: collapsed ? "20px 10px" : "24px 16px", position: "sticky", top: 0, height: "100vh", transition: "width .22s ease, padding .22s ease", overflow: "hidden" }}>

      {/* Toggle + logo row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, minWidth: 0 }}>
        <button onClick={onToggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,.1)", border: "none", cursor: "pointer", color: C.white }}>
          <HamburgerIcon />
        </button>
        {!collapsed && (
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <img src="/logo-white.svg" alt="AI To Market" style={{ height: 24, width: "auto", display: "block" }} />
            <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, letterSpacing: ".1em", opacity: .55, whiteSpace: "nowrap" }}>GEO CONTENT DESK</div>
          </div>
        )}
      </div>

      {/* Workspace / version switcher — hidden when collapsed */}
      {!collapsed && (
        <>
          <div style={{ padding: "0 8px 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", opacity: .5 }}>WORKSPACE</div>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <button
              onClick={() => setShowVersionMenu(v => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", border: "1px solid rgba(255,255,255,.22)", borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", background: "transparent", color: C.white, cursor: "pointer" }}
            >
              <span>AI To Market</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", padding: "2px 6px", borderRadius: 4, background: C.salmon, color: C.dark }}>V2</span>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ opacity: .6, transform: showVersionMenu ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </div>
            </button>

            {showVersionMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#1E4D30", border: "1px solid rgba(255,255,255,.18)", borderRadius: 8, overflow: "hidden", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}>
                {/* V2 — current */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", fontSize: 12, fontWeight: 600, color: C.white, background: "rgba(255,255,255,.08)" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>GEO Content Desk</div>
                    <div style={{ fontSize: 10, fontWeight: 400, opacity: .6, marginTop: 1 }}>Current version</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", padding: "2px 6px", borderRadius: 4, background: C.salmon, color: C.dark }}>V2</span>
                </div>
                {/* Divider */}
                <div style={{ height: 1, background: "rgba(255,255,255,.1)" }} />
                {/* V1 — switch */}
                <button
                  onClick={() => { window.location.href = "/atelier"; }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.75)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>Content Atelier</div>
                    <div style={{ fontSize: 10, fontWeight: 400, opacity: .6, marginTop: 1 }}>Switch to V1</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.7)" }}>V1</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Collapsed: version badge only */}
      {collapsed && (
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
          <button
            onClick={() => { window.location.href = "/atelier"; }}
            title="Switch to V1 – Content Atelier"
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".06em", padding: "3px 6px", borderRadius: 4, background: C.salmon, color: C.dark, border: "none", cursor: "pointer" }}
          >V2</button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(([key, label, d, badge]) => (
          <button
            key={key}
            onClick={() => setScreen(key)}
            title={collapsed ? label : undefined}
            style={{ display: "flex", alignItems: "center", gap: collapsed ? 0 : 11, justifyContent: collapsed ? "center" : "flex-start", width: "100%", textAlign: "left", padding: collapsed ? "10px 0" : "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: screen === key ? 600 : 400, background: screen === key ? "rgba(255,255,255,.16)" : "transparent", color: C.white, border: "none", cursor: "pointer" }}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" style={{ flexShrink: 0, opacity: screen === key ? 1 : .6 }}><path d={d} fill="currentColor" /></svg>
            {!collapsed && <span style={{ flex: 1, whiteSpace: "nowrap" }}>{label}</span>}
            {!collapsed && badge && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "rgba(255,255,255,.16)" }}>{badge}</span>}
          </button>
        ))}
      </nav>

      {/* Credits — click opens AI Usage page */}
      <button
        onClick={onUsageClick}
        title="View AI usage details"
        style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.14)", width: "100%", background: "transparent", border: "none", cursor: "pointer", color: C.white, textAlign: "left", borderRadius: 8, padding: "12px 0 0" }}
      >
        {collapsed ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: 34, height: 6, borderRadius: 4, background: "rgba(255,255,255,.18)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${creditPct}%`, background: creditBarColor(creditPct) }} />
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: 8, padding: "10px 12px", transition: "background .15s", background: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.5 }}>Monthly generation credits</div>
            <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,.18)", margin: "10px 0 6px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${creditPct}%`, background: creditBarColor(creditPct), transition: "background .3s" }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 400, opacity: .7 }}>{creditLabel}</div>
          </div>
        )}
      </button>
    </aside>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function PageHeader({ screen, onGenerate, onKeywords }: { screen: Screen; onGenerate: () => void; onKeywords: () => void }) {
  const [eyebrow, title, subtitle] = SCREEN_HEAD[screen];
  return (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "32px 40px 24px", borderBottom: `1px solid ${C.border}`, background: C.bg, position: "sticky", top: 0, zIndex: 5 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", color: C.mid, marginBottom: 8 }}>{eyebrow}</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-.4px" }}>{title}</h1>
        <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 400, lineHeight: 1.5, maxWidth: "64ch", color: C.muted }}>{subtitle}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={onKeywords} style={{ whiteSpace: "nowrap", padding: "11px 16px", border: "1px solid rgba(22,61,38,.28)", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}>Prompt library</button>
        <button onClick={onGenerate} style={{ whiteSpace: "nowrap", padding: "11px 18px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>New GEO article</button>
      </div>
    </header>
  );
}

// ─── Label / chip helpers ─────────────────────────────────────────────────────

function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.mid }}>{children}</div>;
}

function StageChip({ label, bg }: { label: string; bg: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 20, border: "1px solid rgba(22,61,38,.2)", background: bg }}>{label}</span>;
}

// ─── Dashboard screen ─────────────────────────────────────────────────────────

const STATS = [
  { label: "ANSWER SHARE",       value: "34",  unit: "%",    delta: "up 9 points since April",  color: C.dark },
  { label: "CITATIONS THIS MONTH", value: "218", unit: "",   delta: "across 6 engines",          color: C.dark },
  { label: "DRAFTS IN FLIGHT",   value: "12",  unit: "",     delta: "4 awaiting human review",   color: C.dark },
  { label: "AVG GEO SCORE",      value: "78",  unit: "/ 100",delta: "publish gate set at 75",    color: C.red  },
];

const ENGINES = [
  { name: "ChatGPT",           pct: 41, fill: C.dark },
  { name: "Perplexity",        pct: 37, fill: C.dark },
  { name: "Google AI Overviews", pct: 29, fill: C.mid },
  { name: "Claude",            pct: 24, fill: C.mid },
  { name: "Copilot",           pct: 16, fill: "rgba(22,61,38,.45)" },
  { name: "Gemini",            pct: 11, fill: "rgba(22,61,38,.45)" },
];

const GAPS = [
  { prompt: "how do answer engines choose which sources to cite", meta: "2.4k asks per month · not cited" },
  { prompt: "geo vs seo what is the difference",                  meta: "1.8k asks · competitor cited 6 times" },
  { prompt: "how to measure ai search visibility",                meta: "980 asks · thin coverage" },
  { prompt: "best geo tools for b2b saas",                        meta: "740 asks · not cited" },
];

const DRAFTS_DATA = [
  { title: "What is generative engine optimization?", prompt: "what is geo",       score: 71, stage: "Needs review", stageBg: "rgba(249,57,67,.08)" },
  { title: "How answer engines select sources",        prompt: "how engines cite",  score: 86, stage: "Approved",     stageBg: "rgba(24,95,0,.1)" },
  { title: "GEO vs SEO: what actually changed",        prompt: "geo vs seo",        score: 79, stage: "Scoring",      stageBg: C.faint },
  { title: "Measuring AI search visibility",           prompt: "measure visibility", score: 64, stage: "Drafting",    stageBg: C.faint },
  { title: "Schema markup for citability",             prompt: "schema for geo",    score: 83, stage: "Published",    stageBg: "rgba(24,95,0,.1)" },
];

function DashboardScreen({ dataState, onGenerate, onQueue, onEditor, onAnalytics }: {
  dataState: DataState; onGenerate: () => void; onQueue: () => void;
  onEditor: () => void; onAnalytics: () => void;
}) {
  if (dataState === "loading") {
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, marginBottom: 48 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: 132, borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(22,61,38,.07)", animation: "pulse 1.4s ease-in-out infinite" }} />)}
        </div>
        <div style={{ height: 280, borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(22,61,38,.07)", animation: "pulse 1.4s ease-in-out infinite" }} />
      </div>
    );
  }

  if (dataState === "empty") {
    return (
      <div style={{ maxWidth: 520, margin: "64px auto", textAlign: "center", padding: "48px 40px", border: "1px dashed rgba(22,61,38,.28)", borderRadius: 16, background: C.white }}>
        <div style={{ width: 56, height: 56, margin: "0 auto 24px", border: "2px solid rgba(22,61,38,.24)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 20 20" width="22" height="22"><path d="M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8z" fill={C.dark} /></svg>
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>No visibility data yet</h2>
        <p style={{ margin: "16px 0 0", fontSize: 13, fontWeight: 400, lineHeight: 1.55, color: C.muted }}>Connect a domain and we will start tracking how often answer engines cite you. First results usually land within 48 hours.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
          <button onClick={onGenerate} style={{ padding: "11px 18px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Connect a domain</button>
          <button onClick={onGenerate} style={{ padding: "11px 18px", border: "1px solid rgba(22,61,38,.28)", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}>Draft something anyway</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, marginBottom: 48 }}>
        {STATS.map(s => (
          <div key={s.label} style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
            <EyebrowLabel>{s.label}</EyebrowLabel>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 16 }}>
              <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, letterSpacing: -1, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(22,61,38,.6)" }}>{s.unit}</div>
            </div>
            <div style={{ marginTop: 16, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.65)" }}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Engine share + gaps */}
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 24, marginBottom: 48 }}>
        <section style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Answer share by engine</h2>
            <button onClick={onAnalytics} style={{ fontSize: 11, fontWeight: 600, color: C.mid, background: "none", border: "none", cursor: "pointer" }}>Full report</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {ENGINES.map(e => (
              <div key={e.name} style={{ display: "grid", gridTemplateColumns: "130px 1fr 48px", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{e.name}</div>
                <div style={{ height: 10, borderRadius: 6, background: "rgba(22,61,38,.09)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${e.pct}%`, background: e.fill }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>{e.pct}%</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>Prompt coverage gaps</h2>
          <p style={{ margin: "0 0 24px", fontSize: 12, fontWeight: 400, lineHeight: 1.5, color: "rgba(22,61,38,.7)" }}>Questions buyers ask engines where you are not cited.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {GAPS.map(g => (
              <div key={g.prompt} style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 12, borderBottom: "1px solid rgba(22,61,38,.09)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.45 }}>{g.prompt}</div>
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.6)" }}>{g.meta}</div>
                </div>
                <button onClick={onGenerate} style={{ flexShrink: 0, padding: "6px 10px", border: "1px solid rgba(22,61,38,.24)", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}>Draft</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* In flight table */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>In flight</h2>
          <button onClick={onQueue} style={{ fontSize: 11, fontWeight: 600, color: C.mid, background: "none", border: "none", cursor: "pointer" }}>Open batch queue</button>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1fr 1fr 90px", gap: 16, padding: "14px 24px", background: "rgba(22,61,38,.04)", fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: C.mid }}>
            <div>ARTICLE</div><div>TARGET PROMPT</div><div>GEO SCORE</div><div>STAGE</div><div />
          </div>
          {DRAFTS_DATA.map(d => (
            <div key={d.title} style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1fr 1fr 90px", gap: 16, alignItems: "center", padding: "16px 24px", borderTop: "1px solid rgba(22,61,38,.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{d.title}</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "rgba(22,61,38,.7)" }}>{d.prompt}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor(d.score) }}>{d.score}</div>
                <div style={{ width: 44, height: 6, borderRadius: 4, background: "rgba(22,61,38,.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.score}%`, background: scoreColor(d.score) }} />
                </div>
              </div>
              <div><StageChip label={d.stage} bg={d.stageBg} /></div>
              <div style={{ textAlign: "right" }}>
                <button onClick={onEditor} style={{ fontSize: 11, fontWeight: 600, color: C.mid, background: "none", border: "none", cursor: "pointer" }}>Open</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Generate screen ──────────────────────────────────────────────────────────

const ENTITIES = [
  { name: "AI To Market",                    note: "Brand entity, linked to knowledge panel",    status: "VERIFIED" },
  { name: "Generative engine optimization",  note: "Primary concept, define in first 40 words",  status: "PRIMARY" },
  { name: "Answer engine",                   note: "Supporting concept",                          status: "SUPPORTING" },
  { name: "Retrieval augmented generation",  note: "Technical context, one mention",              status: "OPTIONAL" },
];

const VOICE_DIALS = [
  { label: "Formality",       value: "Enterprise",   pct: 72 },
  { label: "Claim strength",  value: "Declarative",  pct: 84 },
  { label: "Technical depth", value: "Practitioner", pct: 58 },
  { label: "Sentence length", value: "Short",        pct: 34 },
];

const PIPELINE_STEPS = [
  "Pull the prompt set and see who is cited today",
  "Draft with an answer block opening every section",
  "Assert your entities and attach citable sources",
  "Score against quotability, sourcing, structure, entities",
  "Stage for human review, never auto publish below 75",
];

function GenerateScreen({ onSettings, onQueue, onSessionCreated, seedKeywords, defaultFlow }: { onSettings: () => void; onQueue: () => void; onSessionCreated: (opportunityId: string, brief: BriefFields) => void; seedKeywords: string[]; defaultFlow?: FlowMode }) {
  const [flow, setFlow] = useState<FlowMode>(defaultFlow ?? "wizard");
  const [step, setStep] = useState(1);
  const [promptText, setPromptText] = useState("what is generative engine optimization");
  const [adjacentOn, setAdjacentOn] = useState([0, 2]);
  const [togglesOn, setTogglesOn] = useState([0, 1, 3]);
  const [brief, setBrief] = useState("Explainer for B2B marketing leads on how answer engines pick sources, with a comparison of GEO and classic SEO and a short checklist.");
  const [chatInput, setChatInput] = useState("");

  // ── Conversational chat state ────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatBrief, setChatBrief] = useState<BriefFields>({});
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  async function sendMessage(text?: string) {
    const content = (text ?? chatInput).trim();
    if (!content || chatLoading) return;
    const newMessages = [...chatMessages, { role: "user" as const, content }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);
    try {
      const res = await fetch("/api/brief/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { reply: string; brief: BriefFields; readyToGenerate: boolean };
      setChatMessages([...newMessages, { role: "assistant", content: data.reply }]);
      setChatBrief(prev => ({
        ...prev,
        ...Object.fromEntries(Object.entries(data.brief).filter(([, v]) => v)),
      }));
      if (data.readyToGenerate) setReadyToGenerate(true);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to get a response");
    } finally {
      setChatLoading(false);
    }
  }

  async function generateFromBrief() {
    if (!readyToGenerate || generating) return;
    setGenerating(true);
    setChatError(null);
    try {
      const contentBrief = [
        chatBrief.prompt   && `Target prompt: ${chatBrief.prompt}`,
        chatBrief.format   && `Format: ${chatBrief.format}`,
        chatBrief.voice    && `Voice: ${chatBrief.voice}`,
      ].filter(Boolean).join("\n");

      const res = await fetch("/api/builder-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_title: chatBrief.prompt ?? "GEO article",
          opportunity_context: {
            theme: chatBrief.client ?? undefined,
            content_brief: contentBrief || undefined,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { opportunityId: string };
      onSessionCreated(data.opportunityId, chatBrief);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to create session");
      setGenerating(false);
    }
  }

  const ADJACENT_LABELS = ["is geo replacing seo", "does geo work for b2b", "who invented geo", "geo checklist", "geo tools 2026"];
  const TOGGLE_LABELS = ["Inject FAQ schema", "Add comparison table", "Require 3 citable sources", "Write answer block per section"];
  const STEP_LABELS = ["Prompt and format", "Sources and entities", "Voice and constraints", "Review and generate"];
  const STEP_HINTS = ["What we are trying to win", "What we assert and cite", "How it should sound", "Confirm and run"];

  const REVIEW_ROWS = [
    { k: "TARGET PROMPT", v: promptText },
    { k: "ADJACENT",      v: `${adjacentOn.length} prompts also answered` },
    { k: "FORMAT",        v: "Definitional explainer, 1200 to 1600 words" },
    { k: "ENTITIES",      v: "4 asserted, 1 verified against knowledge graph" },
    { k: "VOICE",         v: "AI To Market house style, declarative, short sentences" },
    { k: "COST",          v: "1 credit, roughly 4 minutes" },
  ];

  const btnStyle = (active: boolean): React.CSSProperties => ({
    whiteSpace: "nowrap", flexShrink: 0, padding: "8px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600,
    background: active ? C.dark : "transparent", color: active ? C.white : "rgba(22,61,38,.7)",
    border: "none", cursor: "pointer",
  });

  return (
    <div>
      {/* Flow tabs */}
      <div style={{ display: "flex", gap: 6, padding: 5, marginBottom: 32, border: "1px solid rgba(22,61,38,.16)", borderRadius: 10, width: "fit-content", background: C.white }}>
        {(["wizard", "single", "chat", "keywords"] as FlowMode[]).map(f => (
          <button key={f} onClick={() => setFlow(f)} style={btnStyle(flow === f)}>
            {f === "wizard" ? "Guided wizard" : f === "single" ? "One shot brief" : f === "chat" ? "Conversational" : "Keyword workspace"}
          </button>
        ))}
      </div>

      {/* ── Wizard ── */}
      {flow === "wizard" && (
        <div style={{ display: "grid", gridTemplateColumns: "236px 1fr", gap: 40, alignItems: "start" }}>
          {/* Step sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const active = step === n;
              return (
                <button key={n} onClick={() => setStep(n)} style={{ display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left", padding: 12, borderRadius: 9, background: active ? "rgba(22,61,38,.07)" : "transparent", border: "none", cursor: "pointer", color: C.dark }}>
                  <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: active ? C.dark : "transparent", color: active ? C.white : C.dark, border: "1px solid rgba(22,61,38,.2)" }}>{n}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}>{label}</div>
                    <div style={{ marginTop: 4, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.6)" }}>{STEP_HINTS[i]}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 32, alignItems: "start" }}>
            {/* Step content */}
            <section style={{ padding: 32, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.mid }}>STEP {step} OF 4</div>
              <h2 style={{ margin: "8px 0 24px", fontSize: 22, fontWeight: 700, letterSpacing: "-.3px" }}>{STEP_LABELS[step - 1]}</h2>

              {step === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: C.mid, marginBottom: 8 }}>TARGET PROMPT</label>
                    <input value={promptText} onChange={e => setPromptText(e.target.value)} style={{ width: "100%", padding: "13px 14px", border: "1px solid rgba(22,61,38,.24)", borderRadius: 8, fontSize: 14, fontWeight: 400, color: C.dark, background: C.bg, outline: "none" }} />
                    <div style={{ marginTop: 8, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.6)" }}>Write it the way a buyer types it into an answer engine.</div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: C.mid, marginBottom: 8 }}>ADJACENT PROMPTS WE WILL ALSO ANSWER</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {ADJACENT_LABELS.map((label, i) => {
                        const on = adjacentOn.includes(i);
                        return (
                          <button key={label} onClick={() => setAdjacentOn(prev => on ? prev.filter(x => x !== i) : [...prev, i])} style={{ padding: "7px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? C.dark : "rgba(22,61,38,.24)"}`, background: on ? C.dark : "transparent", color: on ? C.white : C.dark, cursor: "pointer" }}>{label}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {["FORMAT", "LENGTH"].map(lbl => (
                      <div key={lbl}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: C.mid, marginBottom: 8 }}>{lbl}</label>
                        <select style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(22,61,38,.24)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.dark, background: C.bg }}>
                          {lbl === "FORMAT" ? <>
                            <option>Definitional explainer</option><option>Comparison table article</option>
                            <option>Step by step guide</option><option>Statistics roundup</option>
                          </> : <>
                            <option>1200 to 1600 words</option><option>800 to 1200 words</option><option>2000 words plus</option>
                          </>}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: C.mid, marginBottom: 8 }}>ENTITIES TO ASSERT</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {ENTITIES.map(en => (
                        <div key={en.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid rgba(22,61,38,.14)", borderRadius: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{en.name}</div>
                            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.62)" }}>{en.note}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "4px 8px", borderRadius: 5, background: "rgba(24,95,0,.1)", color: C.mid }}>{en.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: C.mid, marginBottom: 8 }}>CITABLE SOURCES</label>
                    <div style={{ padding: 20, border: "1px dashed rgba(22,61,38,.28)", borderRadius: 8, textAlign: "center", fontSize: 12, fontWeight: 400, color: "rgba(22,61,38,.7)" }}>Drop research PDFs, or paste URLs. Engines cite pages that cite sources.</div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px solid rgba(22,61,38,.14)", borderRadius: 8, background: "rgba(24,95,0,.05)" }}>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>Voice profile: AI To Market house style</div>
                    <button onClick={onSettings} style={{ fontSize: 11, fontWeight: 600, color: C.mid, background: "none", border: "none", cursor: "pointer" }}>Edit profile</button>
                  </div>
                  {VOICE_DIALS.map(v => (
                    <div key={v.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                        <span>{v.label}</span><span style={{ fontWeight: 400, color: "rgba(22,61,38,.65)" }}>{v.value}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "rgba(22,61,38,.1)", position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v.pct}%`, background: C.dark, borderRadius: 4 }} />
                        <div style={{ position: "absolute", left: `${v.pct}%`, top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: "50%", background: C.white, border: `2px solid ${C.dark}` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {step === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {REVIEW_ROWS.map(r => (
                    <div key={r.k} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 16, paddingBottom: 16, borderBottom: "1px solid rgba(22,61,38,.09)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: C.mid }}>{r.k}</div>
                      <div style={{ fontSize: 13, fontWeight: 400, lineHeight: 1.5 }}>{r.v}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <button onClick={onQueue} style={{ padding: "13px 22px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Generate article</button>
                    <button onClick={onQueue} style={{ padding: "13px 18px", border: "1px solid rgba(22,61,38,.28)", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}>Add to batch instead</button>
                  </div>
                </div>
              )}

              {step < 4 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(22,61,38,.1)" }}>
                  <button onClick={() => setStep(s => Math.max(1, s - 1))} style={{ fontSize: 12, fontWeight: 600, color: "rgba(22,61,38,.6)", background: "none", border: "none", cursor: "pointer" }}>Back</button>
                  <button onClick={() => setStep(s => Math.min(4, s + 1))} style={{ padding: "12px 20px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Continue</button>
                </div>
              )}
            </section>

            {/* Predicted score sidebar */}
            <aside style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, position: "sticky", top: 180 }}>
              <EyebrowLabel>PREDICTED GEO SCORE</EyebrowLabel>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 14 }}>
                <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, letterSpacing: -1.5, color: C.red }}>82</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(22,61,38,.55)" }}>/ 100</div>
              </div>
              <p style={{ margin: "16px 0 0", fontSize: 12, fontWeight: 400, lineHeight: 1.55, color: "rgba(22,61,38,.72)" }}>Based on prompt competition, entity coverage and how many sources you attached.</p>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(22,61,38,.1)", display: "flex", flexDirection: "column", gap: 12 }}>
                {[["Prompt competition", "Moderate"], ["Entity coverage", "4 of 5"], ["Attached sources", "3"]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, fontWeight: 400 }}>
                    <span style={{ color: "rgba(22,61,38,.7)" }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* ── Single shot ── */}
      {flow === "single" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, alignItems: "start" }}>
          <section style={{ padding: 32, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700, letterSpacing: "-.3px" }}>One brief, one pass</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: C.mid, marginBottom: 8 }}>BRIEF</label>
                <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={7} style={{ width: "100%", padding: 14, border: "1px solid rgba(22,61,38,.24)", borderRadius: 8, fontSize: 14, fontWeight: 400, lineHeight: 1.55, color: C.dark, background: C.bg, resize: "vertical", outline: "none" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                {[["FORMAT", "Definitional explainer"], ["LENGTH", "1200 to 1600"], ["VOICE", "House style"]].map(([lbl, val]) => (
                  <div key={lbl}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: C.mid, marginBottom: 8 }}>{lbl}</label>
                    <div style={{ padding: "12px 14px", border: "1px solid rgba(22,61,38,.24)", borderRadius: 8, fontSize: 13, fontWeight: 600, background: C.bg }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TOGGLE_LABELS.map((label, i) => {
                  const on = togglesOn.includes(i);
                  return (
                    <button key={label} onClick={() => setTogglesOn(prev => on ? prev.filter(x => x !== i) : [...prev, i])} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? "rgba(22,61,38,.4)" : "rgba(22,61,38,.18)"}`, background: on ? "rgba(22,61,38,.06)" : "transparent", color: C.dark, cursor: "pointer" }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, border: "1px solid rgba(22,61,38,.3)", background: on ? C.dark : "transparent", display: "inline-block" }} />
                      {label}
                    </button>
                  );
                })}
              </div>
              <button onClick={onQueue} style={{ alignSelf: "flex-start", padding: "14px 24px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Generate and score</button>
            </div>
          </section>
          <aside style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.dark, color: C.white, position: "sticky", top: 180 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", opacity: .75 }}>WHAT WE WILL DO</div>
            <ol style={{ margin: "16px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 12, fontSize: 12, fontWeight: 400, lineHeight: 1.5 }}>
              {PIPELINE_STEPS.map(p => <li key={p}>{p}</li>)}
            </ol>
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.18)", fontSize: 11, fontWeight: 400, opacity: .75 }}>Typical run: 3 to 5 minutes, 1 credit.</div>
          </aside>
        </div>
      )}

      {/* ── Chat ── */}
      {flow === "chat" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, alignItems: "start" }}>
          <section style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, display: "flex", flexDirection: "column", minHeight: 520 }}>
            {/* Messages */}
            <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", maxHeight: 420 }}>
              {chatMessages.length === 0 && (
                <div style={{ margin: "auto", textAlign: "center", color: C.muted, fontSize: 13, lineHeight: 1.65, maxWidth: 320, padding: "32px 0" }}>
                  Describe the article you need — the target prompt, client name, or topic you want to own. I will ask a follow-up if I need more.
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 12, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "78%", padding: "14px 16px", borderRadius: 12, fontSize: 13, fontWeight: 400, lineHeight: 1.55, background: m.role === "user" ? C.dark : C.bg, color: m.role === "user" ? C.white : C.dark, border: `1px solid ${m.role === "user" ? C.dark : "rgba(22,61,38,.14)"}` }}>{m.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "12px 16px", borderRadius: 12, fontSize: 13, background: C.bg, border: "1px solid rgba(22,61,38,.14)", color: C.muted }}>Thinking…</div>
                </div>
              )}
              {chatError && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FFF0F0", border: "1px solid rgba(249,57,67,.25)", color: C.red, fontSize: 12 }}>{chatError}</div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(22,61,38,.1)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {["Yes, go ahead", "Make it a comparison article", "Keep it under 1,000 words"].map(label => (
                  <button key={label} onClick={() => sendMessage(label)} disabled={chatLoading} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid rgba(22,61,38,.22)", fontSize: 11, fontWeight: 600, background: "none", cursor: chatLoading ? "default" : "pointer", color: C.dark, opacity: chatLoading ? 0.5 : 1 }}>{label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                  placeholder="Describe the article, or paste a prompt you want to win"
                  disabled={chatLoading}
                  style={{ flex: 1, padding: "13px 14px", border: "1px solid rgba(22,61,38,.24)", borderRadius: 8, fontSize: 13, fontWeight: 400, background: C.bg, color: C.dark, outline: "none", opacity: chatLoading ? 0.6 : 1 }}
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{ padding: "13px 20px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: chatLoading || !chatInput.trim() ? "default" : "pointer", opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}
                >
                  Send
                </button>
              </div>
            </div>
          </section>

          {/* Brief sidebar */}
          <aside style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, position: "sticky", top: 180 }}>
            <EyebrowLabel>BRIEF SO FAR</EyebrowLabel>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              {([
                ["CLIENT",          chatBrief.client,         C.dark],
                ["PROMPT",          chatBrief.prompt,         C.dark],
                ["FORMAT",          chatBrief.format,         C.dark],
                ["VOICE",           chatBrief.voice,          C.dark],
                ["PREDICTED SCORE", chatBrief.predictedScore, C.mid],
              ] as [string, string | undefined, string][]).map(([k, v, color]) => (
                <div key={k} style={{ paddingBottom: 14, borderBottom: "1px solid rgba(22,61,38,.09)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".09em", color: "rgba(22,61,38,.5)" }}>{k}</div>
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, lineHeight: 1.45, color: v ? color : "rgba(22,61,38,.28)", fontStyle: v ? "normal" : "italic" }}>
                    {v ?? "—"}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => void generateFromBrief()}
              disabled={!readyToGenerate || generating}
              style={{ width: "100%", marginTop: 20, padding: 13, borderRadius: 8, background: readyToGenerate ? C.dark : "rgba(22,61,38,.18)", color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: readyToGenerate && !generating ? "pointer" : "not-allowed", opacity: generating ? 0.7 : 1, transition: "background .3s" }}
            >
              {generating ? "Creating draft…" : readyToGenerate ? "Generate from this brief" : "Building brief…"}
            </button>
          </aside>
        </div>
      )}

      {/* ── Keywords ── */}
      {flow === "keywords" && (
        <KeywordWorkspace seedKeywords={seedKeywords} />
      )}
    </div>
  );
}

// ─── Queue screen ─────────────────────────────────────────────────────────────

const QUEUE_ROWS_DATA = [
  { prompt: "how do answer engines choose sources",  cluster: "Mechanics",   stage: "Drafting",      pct: 46,  action: "View" },
  { prompt: "geo vs seo what changed",               cluster: "Comparison",  stage: "Scoring",       pct: 78,  action: "View" },
  { prompt: "how to measure ai search visibility",   cluster: "Measurement", stage: "Needs review",  pct: 100, action: "Review" },
  { prompt: "best geo tools for b2b saas",           cluster: "Tools",       stage: "Queued",        pct: 0,   action: "View" },
  { prompt: "does schema markup help geo",           cluster: "Mechanics",   stage: "Approved",      pct: 100, action: "Open" },
  { prompt: "geo checklist for content teams",       cluster: "Playbook",    stage: "Drafting",      pct: 23,  action: "View" },
  { prompt: "why is my site not cited by chatgpt",   cluster: "Diagnostics", stage: "Scoring",       pct: 64,  action: "View" },
  { prompt: "how often do engines refresh sources",  cluster: "Mechanics",   stage: "Queued",        pct: 0,   action: "View" },
];

function QueueScreen({ onEditor, onGenerate }: { onEditor: () => void; onGenerate: () => void }) {
  const [selected, setSelected] = useState([1, 2, 4]);
  const toggleSelect = (i: number) => setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  return (
    <div>
      {/* Bulk action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", marginBottom: 24, border: "1px solid rgba(22,61,38,.16)", borderRadius: 10, background: C.white }}>
        <div style={{ whiteSpace: "nowrap", flexShrink: 0, fontSize: 12, fontWeight: 600 }}>{selected.length} selected</div>
        <div style={{ width: 1, height: 20, background: "rgba(22,61,38,.14)" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Rescore", "Approve", "Schedule", "Reassign voice"].map(ba => (
            <button key={ba} style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "8px 13px", border: "1px solid rgba(22,61,38,.22)", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}>{ba}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", whiteSpace: "nowrap", flexShrink: 0, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.62)" }}>Batch 041 · started 09:12 · 12 prompts</div>
      </div>

      {/* Queue table */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "28px 2.2fr 1.1fr 1fr 1.4fr 80px", gap: 16, padding: "14px 20px", background: "rgba(22,61,38,.04)", fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: C.mid }}>
          <div /><div>PROMPT</div><div>CLUSTER</div><div>STAGE</div><div>PROGRESS</div><div />
        </div>
        {QUEUE_ROWS_DATA.map((q, i) => {
          const isSelected = selected.includes(i);
          const fill = q.stage === "Needs review" ? C.red : q.pct === 100 ? C.mid : C.dark;
          const stageBg = q.stage === "Needs review" ? "rgba(249,57,67,.08)" : q.stage === "Approved" ? "rgba(24,95,0,.1)" : "rgba(22,61,38,.05)";
          return (
            <div key={q.prompt} style={{ display: "grid", gridTemplateColumns: "28px 2.2fr 1.1fr 1fr 1.4fr 80px", gap: 16, alignItems: "center", padding: "15px 20px", borderTop: "1px solid rgba(22,61,38,.08)" }}>
              <button onClick={() => toggleSelect(i)} style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid rgba(22,61,38,.3)", background: isSelected ? C.dark : "transparent", cursor: "pointer", flexShrink: 0 }} />
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{q.prompt}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.mid }}>{q.cluster}</div>
              <div><StageChip label={q.stage} bg={stageBg} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 4, background: "rgba(22,61,38,.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${q.pct}%`, background: fill }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, width: 32, textAlign: "right" }}>{q.pct}%</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <button onClick={onEditor} style={{ fontSize: 11, fontWeight: 600, color: C.mid, background: "none", border: "none", cursor: "pointer" }}>{q.action}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Draft card component ─────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function DraftCardComponent({ card, onCreateArticle, onResume, onRemove }: {
  card: DraftCard;
  onCreateArticle: () => void;
  onResume?: () => void;
  onRemove?: () => void;
}) {
  const rawScore = card.brief.predictedScore ? parseInt(card.brief.predictedScore) : NaN;
  const scoreNum = isNaN(rawScore) ? null : rawScore;

  return (
    <div style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, display: "flex", flexDirection: "column", minHeight: 220, position: "relative" }}>
      {/* X remove button */}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          title="Remove"
          style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid rgba(249,57,67,.35)`, background: "rgba(249,57,67,.07)", color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      )}
      {/* Header: badge + score */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, paddingRight: onRemove ? 28 : 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: C.mid, background: "rgba(24,95,0,.1)", padding: "4px 9px", borderRadius: 20 }}>READY TO BUILD</span>
        {scoreNum !== null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: scoreColor(scoreNum) }}>{scoreNum}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginTop: 2 }}>/ 100</div>
          </div>
        )}
      </div>

      {/* Prompt (title) */}
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: C.dark, marginBottom: 10, flex: 1 }}>
        {card.brief.prompt ?? "Untitled brief"}
      </div>

      {/* Format */}
      {card.brief.format && (
        <div style={{ fontSize: 12, fontWeight: 400, color: C.muted, marginBottom: 6 }}>{card.brief.format}</div>
      )}

      {/* Client */}
      {card.brief.client && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 12, background: C.faint, color: C.dark }}>{card.brief.client}</span>
        </div>
      )}

      {/* Timestamp */}
      <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.42)", marginTop: 14, marginBottom: 16, paddingTop: 12, borderTop: "1px solid rgba(22,61,38,.08)" }}>
        {timeAgo(card.createdAt)}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCreateArticle}
          style={{ flex: 1, padding: "11px 14px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
        >
          Create Article
        </button>
        <button
          onClick={onResume}
          style={{ padding: "11px 14px", border: "1px solid rgba(22,61,38,.28)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark, whiteSpace: "nowrap" }}
        >
          Resume
        </button>
      </div>
    </div>
  );
}

// ─── Editor screen ────────────────────────────────────────────────────────────

const SUGGESTIONS_DATA = [
  { kind: "SOURCING",  impact: "+6 predicted", title: "Attribute the retrieval claim",      body: "Engines rarely cite unsourced assertions. Add the sample size and study you are drawing on." },
  { kind: "ENTITIES",  impact: "+5 predicted", title: "Name the brand entity twice more",   body: "AI To Market appears once. Two more natural mentions raise entity confidence." },
  { kind: "STRUCTURE", impact: "+4 predicted", title: "Add an answer block to the FAQ",     body: "The FAQ section opens with context instead of the answer. Lead with the 25 word version." },
];

const OUTLINE_ITEMS = [
  { label: "H1 What is GEO?",            indent: 10,  weight: "600", bg: "rgba(22,61,38,.07)", color: C.dark },
  { label: "Answer block",               indent: 22,  weight: "400", bg: "transparent",       color: "rgba(22,61,38,.7)" },
  { label: "GEO vs SEO",                 indent: 22,  weight: "400", bg: "transparent",       color: "rgba(22,61,38,.7)" },
  { label: "How engines pick sources",    indent: 22,  weight: "400", bg: "transparent",       color: "rgba(22,61,38,.7)" },
  { label: "Checklist",                  indent: 22,  weight: "400", bg: "transparent",       color: "rgba(22,61,38,.7)" },
  { label: "FAQ (thin)",                 indent: 22,  weight: "400", bg: "transparent",       color: C.red },
];

// ─── Outline section type config ──────────────────────────────────────────────

const SECTION_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  introduction: { bg: "rgba(22,61,38,.09)",  color: C.dark },
  stats:        { bg: "rgba(249,57,67,.08)", color: "#B0121B" },
  faq:          { bg: "rgba(248,131,121,.15)", color: "#8B3A2A" },
  conclusion:   { bg: "rgba(24,95,0,.1)",    color: C.mid },
  how_to:       { bg: "rgba(22,61,38,.06)",  color: C.dark },
  comparison:   { bg: "rgba(22,61,38,.06)",  color: C.dark },
  section:      { bg: "rgba(22,61,38,.05)",  color: "rgba(22,61,38,.7)" },
};

function sectionTypeStyle(type: string) {
  return SECTION_TYPE_COLORS[type] ?? SECTION_TYPE_COLORS.section;
}

// ─── Editor screen ────────────────────────────────────────────────────────────

function EditorScreen({ onScore, onPublish, draftCards, activeCardId, onActivateCard, onBackToCards, onResumeChat, onTrashCard }: { onScore: () => void; onPublish: () => void; draftCards?: DraftCard[]; activeCardId: string | null; onActivateCard: (id: string) => void; onBackToCards: () => void; onResumeChat?: () => void; onTrashCard?: (id: string) => void }) {
  // ── Plan step state ────────────────────────────────────────────────────────
  type EditorStep = "plan" | "article";
  const [editorStep, setEditorStep] = useState<EditorStep>("plan");
  const [outline, setOutline] = useState<V2OutlineSection[]>([]);
  const [articleTitle, setArticleTitle] = useState("");
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [editingTitles, setEditingTitles] = useState<Record<number, string>>({});
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [savePulse, setSavePulse] = useState(false);
  const prevCardIdRef = useRef<string | null>(null);
  const preloadedPlanRef = useRef<{ outline: V2OutlineSection[]; title: string; brief: BriefFields } | null>(null);

  // ── Article step state (static mockup until wired in next build) ───────────
  const [accepted, setAccepted] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const liveScore = 71 + accepted.length * 6;

  // ── Load saved plans from localStorage on mount ────────────────────────────
  useEffect(() => { setSavedPlans(readSavedPlans()); }, []);

  // ── Generate outline when a card is activated ──────────────────────────────
  useEffect(() => {
    if (!activeCardId || prevCardIdRef.current === activeCardId) return;
    prevCardIdRef.current = activeCardId;

    // If resuming a saved plan — skip the API call and restore directly
    if (preloadedPlanRef.current) {
      const { outline: saved, title, brief: savedBrief } = preloadedPlanRef.current;
      void savedBrief;
      preloadedPlanRef.current = null;
      setEditorStep("plan");
      setOutline(saved);
      setArticleTitle(title);
      setEditingTitles({});
      setExpandedSection(null);
      setOutlineError(null);
      setOutlineLoading(false);
      return;
    }

    const card = draftCards?.find(c => c.opportunityId === activeCardId);
    setEditorStep("plan");
    setOutline([]);
    setEditingTitles({});
    setExpandedSection(null);
    setOutlineError(null);
    setOutlineLoading(true);

    fetch(`/api/builder-sessions/${activeCardId}/generate-outline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_title: card?.brief?.prompt ?? "Article" }),
    })
      .then(r => r.ok ? r.json() as Promise<{ article_title: string; sections: V2OutlineSection[] }> : Promise.reject(r.statusText))
      .then(data => {
        setArticleTitle(data.article_title ?? card?.brief?.prompt ?? "Article");
        setOutline(data.sections ?? []);
      })
      .catch(e => setOutlineError(String(e)))
      .finally(() => setOutlineLoading(false));
  }, [activeCardId, draftCards]);

  // ── Save current plan ──────────────────────────────────────────────────────
  function handleSavePlan() {
    if (!activeCardId || outline.length === 0) return;
    const card = draftCards?.find(c => c.opportunityId === activeCardId);
    const finalOutline = outline.map((s, i) => ({
      ...s,
      title: editingTitles[i] !== undefined ? editingTitles[i] : s.title,
    }));
    const plan: SavedPlan = {
      opportunityId: activeCardId,
      articleTitle,
      outline: finalOutline,
      brief: card?.brief ?? {},
      savedAt: new Date().toISOString(),
    };
    const existing = readSavedPlans();
    const updated = [plan, ...existing.filter(p => p.opportunityId !== activeCardId)];
    writeSavedPlans(updated);
    setSavedPlans(updated);
    setSavePulse(true);
    setTimeout(() => setSavePulse(false), 1400);
  }

  // ── Resume a saved plan ────────────────────────────────────────────────────
  function handleResumeSavedPlan(plan: SavedPlan) {
    preloadedPlanRef.current = { outline: plan.outline, title: plan.articleTitle, brief: plan.brief };
    prevCardIdRef.current = null; // allow the useEffect to fire for this id
    onActivateCard(plan.opportunityId);
  }

  // ── Delete a saved plan ────────────────────────────────────────────────────
  function handleDeleteSavedPlan(opportunityId: string) {
    const updated = savedPlans.filter(p => p.opportunityId !== opportunityId);
    writeSavedPlans(updated);
    setSavedPlans(updated);
  }

  // ── Helper: get the (possibly edited) title for a section ─────────────────
  function getSectionTitle(idx: number, original: string) {
    return editingTitles[idx] !== undefined ? editingTitles[idx] : original;
  }

  // ── Card grid ──────────────────────────────────────────────────────────────
  const showCardGrid = (draftCards?.length ?? 0) > 0 && !activeCardId;

  if (showCardGrid) {
    return (
      <div>
        {/* ── Saved plans section ── */}
        {savedPlans.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.mid, marginBottom: 8 }}>SAVED PLANS</div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.3px" }}>
                  {savedPlans.length} plan{savedPlans.length !== 1 ? "s" : ""} in progress
                </h2>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
              {savedPlans.map(plan => (
                <div key={plan.opportunityId} style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, display: "flex", flexDirection: "column", minHeight: 200, position: "relative" }}>
                  {/* Remove button */}
                  <button
                    onClick={() => handleDeleteSavedPlan(plan.opportunityId)}
                    title="Remove"
                    style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid rgba(249,57,67,.35)`, background: "rgba(249,57,67,.07)", color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}
                  >×</button>

                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingRight: 28 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: C.mid, background: "rgba(24,95,0,.1)", padding: "4px 9px", borderRadius: 20 }}>PLAN SAVED</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 20, background: C.faint, color: "rgba(22,61,38,.6)" }}>{plan.outline.length} sections</span>
                  </div>

                  {/* Title */}
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: C.dark, marginBottom: 10, flex: 1 }}>
                    {plan.articleTitle || plan.brief?.prompt || "Untitled plan"}
                  </div>

                  {/* Section type chips */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
                    {plan.outline.slice(0, 5).map((s, i) => {
                      const ts = sectionTypeStyle(s.type);
                      return (
                        <span key={i} style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".06em", padding: "2px 6px", borderRadius: 4, background: ts.bg, color: ts.color, textTransform: "uppercase" }}>
                          {s.type}
                        </span>
                      );
                    })}
                    {plan.outline.length > 5 && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: C.faint, color: "rgba(22,61,38,.5)" }}>+{plan.outline.length - 5}</span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.42)", marginBottom: 16, paddingTop: 12, borderTop: "1px solid rgba(22,61,38,.08)" }}>
                    {timeAgo(plan.savedAt)}
                  </div>

                  {/* Resume button */}
                  <button
                    onClick={() => handleResumeSavedPlan(plan)}
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
                  >
                    Resume plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── All opportunities section ── */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.mid, marginBottom: 8 }}>ALL OPPORTUNITIES</div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.3px" }}>
              {draftCards!.length} brief{draftCards!.length !== 1 ? "s" : ""} ready to build
            </h2>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {draftCards!.map(card => (
            <DraftCardComponent
              key={card.opportunityId}
              card={card}
              onCreateArticle={() => onActivateCard(card.opportunityId)}
              onResume={onResumeChat}
              onRemove={() => onTrashCard?.(card.opportunityId)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Back button (shared between plan and article steps) ───────────────────
  const BackBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28, padding: "8px 14px", border: "1px solid rgba(22,61,38,.22)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: C.white, color: C.dark, cursor: "pointer" }}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 12L6 8l4-4" />
      </svg>
      {label}
    </button>
  );

  // ── Step breadcrumb ────────────────────────────────────────────────────────
  const StepBar = ({ current }: { current: 1 | 2 }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
      {([
        [1, "Plan"],
        [2, "Article"],
      ] as [number, string][]).map(([n, label], i) => {
        const active = current === n;
        const done = current > n;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && <div style={{ width: 32, height: 1, background: done ? C.mid : "rgba(22,61,38,.2)", margin: "0 12px" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: active ? C.dark : done ? C.mid : "rgba(22,61,38,.1)", color: active || done ? C.white : "rgba(22,61,38,.4)" }}>
                {done ? "✓" : n}
              </div>
              <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? C.dark : done ? C.mid : "rgba(22,61,38,.4)" }}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── PLAN STEP ─────────────────────────────────────────────────────────────
  if (editorStep === "plan") {
    const activeCard = draftCards?.find(c => c.opportunityId === activeCardId);

    return (
      <div style={{ maxWidth: 820 }}>
        <BackBtn label="All opportunities" onClick={onBackToCards} />
        <StepBar current={1} />

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.mid, marginBottom: 10 }}>ARTICLE PLAN</div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-.4px" }}>
            {outlineLoading ? "Generating outline…" : (articleTitle || activeCard?.brief?.prompt || "Article plan")}
          </h2>
          {activeCard?.brief?.client && (
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(22,61,38,.6)", fontWeight: 500 }}>
              Client: {activeCard.brief.client}
              {activeCard.brief.format && <span style={{ marginLeft: 12 }}>{activeCard.brief.format}</span>}
            </div>
          )}
        </div>

        {/* Loading skeletons */}
        {outlineLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ height: 72, borderRadius: 10, background: "rgba(22,61,38,.06)", animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.1}s` }} />
            ))}
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(22,61,38,.5)", fontWeight: 500 }}>
              Building a GEO-optimised plan for this topic…
            </div>
          </div>
        )}

        {/* Error state */}
        {outlineError && !outlineLoading && (
          <div style={{ padding: "20px 24px", border: `1px solid rgba(249,57,67,.3)`, borderRadius: 10, background: "rgba(249,57,67,.04)", color: C.red, fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Could not generate outline</div>
            <div style={{ fontWeight: 400, opacity: .8 }}>{outlineError}</div>
            <button
              onClick={() => { prevCardIdRef.current = null; setOutlineError(null); }}
              style={{ marginTop: 14, padding: "8px 14px", borderRadius: 7, background: C.red, color: C.white, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Outline sections */}
        {!outlineLoading && outline.length > 0 && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {outline.map((section, idx) => {
                const typeStyle = sectionTypeStyle(section.type);
                const isExpanded = expandedSection === idx;
                const editedTitle = getSectionTitle(idx, section.title);

                return (
                  <div
                    key={idx}
                    style={{ border: `1px solid ${isExpanded ? "rgba(22,61,38,.22)" : C.border}`, borderRadius: 10, background: isExpanded ? C.white : "rgba(255,255,255,.7)", transition: "all .15s" }}
                  >
                    {/* Section header row */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", cursor: "pointer" }}
                      onClick={() => setExpandedSection(isExpanded ? null : idx)}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(22,61,38,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "rgba(22,61,38,.55)", flexShrink: 0 }}>
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isExpanded ? (
                          <input
                            value={editedTitle}
                            onChange={e => setEditingTitles(prev => ({ ...prev, [idx]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            style={{ width: "100%", fontSize: 14, fontWeight: 600, color: C.dark, border: "none", background: "transparent", outline: "none", padding: 0 }}
                          />
                        ) : (
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {editedTitle}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "3px 8px", borderRadius: 5, background: typeStyle.bg, color: typeStyle.color, textTransform: "uppercase", flexShrink: 0 }}>
                        {section.type}
                      </span>
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, opacity: .45, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </div>

                    {/* Description bullets (expanded) */}
                    {isExpanded && section.description.length > 0 && (
                      <div style={{ padding: "0 18px 18px 60px", display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid rgba(22,61,38,.07)" }}>
                        <div style={{ paddingTop: 14 }}>
                          {section.description.map((line, li) => (
                            <div key={li} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                              <div style={{ width: 14, height: 1.5, background: C.mid, marginTop: 9, flexShrink: 0 }} />
                              <div style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.55, color: "rgba(22,61,38,.72)" }}>{line}</div>
                            </div>
                          ))}
                          {section.keywords.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                              {section.keywords.map(kw => (
                                <span key={kw} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "rgba(22,61,38,.07)", color: "rgba(22,61,38,.65)" }}>{kw}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(22,61,38,.1)" }}>
              <button
                onClick={() => setEditorStep("article")}
                style={{ padding: "13px 24px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                Generate article
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h8M9 4l4 4-4 4" />
                </svg>
              </button>
              <button
                onClick={handleSavePlan}
                style={{ padding: "13px 18px", border: `1.5px solid ${savePulse ? C.mid : "rgba(22,61,38,.28)"}`, borderRadius: 8, fontSize: 13, fontWeight: 600, background: savePulse ? "rgba(24,95,0,.07)" : "none", cursor: "pointer", color: savePulse ? C.mid : C.dark, display: "flex", alignItems: "center", gap: 7, transition: "all .2s" }}
              >
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H4L2 4v10h12V4l-1-2z" /><path d="M5 2v4h6V2" /><rect x="4" y="10" width="8" height="4" />
                </svg>
                {savePulse ? "Saved!" : "Save"}
              </button>
              <button
                onClick={() => { prevCardIdRef.current = null; setOutlineLoading(true); setOutline([]); }}
                style={{ padding: "13px 18px", border: "1px solid rgba(22,61,38,.28)", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}
              >
                Regenerate outline
              </button>
              <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.5)" }}>
                {outline.length} sections · click any row to expand
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── ARTICLE STEP ──────────────────────────────────────────────────────────
  return (
    <>
      <BackBtn label="Back to plan" onClick={() => setEditorStep("plan")} />
      <StepBar current={2} />

      <div style={{ display: "grid", gridTemplateColumns: "212px 1fr 340px", gap: 28, alignItems: "start" }}>
        {/* Outline sidebar */}
        <aside style={{ position: "sticky", top: 180 }}>
          <EyebrowLabel>OUTLINE</EyebrowLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 14 }}>
            {outline.length > 0 ? outline.map((s, i) => (
              <div key={i} style={{ padding: "8px 10px", borderRadius: 7, fontSize: 12, fontWeight: i === 0 ? 600 : 400, lineHeight: 1.4, background: i === 0 ? "rgba(22,61,38,.09)" : "transparent", color: C.dark }}>
                {getSectionTitle(i, s.title)}
              </div>
            )) : OUTLINE_ITEMS.map(o => (
              <div key={o.label} style={{ padding: "8px 10px", borderRadius: 7, fontSize: 12, fontWeight: o.weight as never, lineHeight: 1.4, background: o.bg, paddingLeft: o.indent, color: o.color }}>{o.label}</div>
            ))}
          </div>
          <div style={{ marginTop: 24, padding: 14, border: "1px solid rgba(22,61,38,.14)", borderRadius: 9 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Answer block coverage</div>
            <div style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.5, color: "rgba(22,61,38,.68)" }}>4 of 6 sections open with a direct, quotable answer.</div>
          </div>
        </aside>

        {/* Document */}
        <section style={{ padding: "44px 48px", border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: C.mid }}>DRAFT · GENERATING…</div>
          <h2 style={{ margin: "14px 0 0", fontSize: 30, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-.6px" }}>
            {articleTitle || "Generating article…"}
          </h2>
          <p style={{ margin: "20px 0 0", fontSize: 15, fontWeight: 400, lineHeight: 1.65, color: C.dark }}>Generative engine optimization is the practice of structuring content so that answer engines quote it. Where search optimization competed for a ranked link, GEO competes for a sentence inside a generated answer.</p>
          <div style={{ marginTop: 28 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 600 }}>GEO versus SEO</h3>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 400, lineHeight: 1.65, color: C.dark }}>Both aim at discovery, but the unit of victory differs. SEO wins a position in a list. GEO wins a clause inside a synthesized answer, which means the writing has to be extractable on its own.</p>
          </div>
          <div style={{ marginTop: 28 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 600 }}>How engines pick sources</h3>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 400, lineHeight: 1.65, color: C.dark, background: accepted.length > 0 ? "rgba(24,95,0,.06)" : "transparent", borderLeft: accepted.length > 0 ? `3px solid ${C.mid}` : "0", padding: accepted.length > 0 ? "14px 16px" : 0 }}>
              {accepted.length > 0 ? "Retrieval favours pages that state a claim plainly, attribute it, and repeat the entity by name. In our sample of 4,100 answers, 71 percent of cited passages were under 60 words." : "Retrieval favours pages that state claims plainly. Engines tend to prefer content that is easy to quote."}
            </p>
          </div>
          <div style={{ marginTop: 28 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 600 }}>A working checklist</h3>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 400, lineHeight: 1.65, color: C.dark }}>Open every section with a direct answer. Attribute every number. Name the entity instead of writing it or the company. Keep paragraphs under 60 words so a passage can be lifted whole.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 36, paddingTop: 24, borderTop: "1px solid rgba(22,61,38,.1)" }}>
            <button onClick={onScore} style={{ padding: "12px 18px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Rescore draft</button>
            <button onClick={onPublish} style={{ padding: "12px 18px", border: "1px solid rgba(22,61,38,.28)", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}>Send to WordPress</button>
            <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.6)" }}>{accepted.length} of 3 suggestions applied</div>
          </div>
        </section>

        {/* Live score + suggestions */}
        <aside style={{ position: "sticky", top: 180, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 20, border: `1px solid ${C.border}`, borderRadius: 12, background: C.dark, color: C.white }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", opacity: .75 }}>LIVE GEO SCORE</div>
              <div style={{ fontSize: 11, fontWeight: 400, opacity: .7 }}>{accepted.length ? `up ${accepted.length * 6} this session` : "no change yet"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
              <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: -1.4, color: C.salmon }}>{liveScore}</div>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: .7 }}>/ 100</div>
            </div>
          </div>
          <EyebrowLabel>AI SUGGESTIONS</EyebrowLabel>
          {SUGGESTIONS_DATA.map((sg, i) => {
            const isAccepted = accepted.includes(i);
            const isDismissed = dismissed.includes(i);
            return (
              <div key={i} style={{ padding: 18, border: `1px solid ${isAccepted ? C.mid : isDismissed ? "rgba(22,61,38,.1)" : "rgba(22,61,38,.16)"}`, borderRadius: 11, background: isAccepted ? "rgba(24,95,0,.06)" : isDismissed ? "rgba(22,61,38,.03)" : C.white }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "3px 7px", borderRadius: 5, background: "rgba(24,95,0,.12)", color: C.mid }}>{sg.kind}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(22,61,38,.62)" }}>{sg.impact}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.45 }}>{sg.title}</div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 400, lineHeight: 1.5, color: "rgba(22,61,38,.72)" }}>{sg.body}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={() => { setAccepted(prev => prev.includes(i) ? prev : [...prev, i]); setDismissed(prev => prev.filter(x => x !== i)); }} style={{ padding: "8px 13px", borderRadius: 7, background: C.dark, color: C.white, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer" }}>{isAccepted ? "Applied" : "Apply"}</button>
                  <button onClick={() => { setDismissed(prev => prev.includes(i) ? prev : [...prev, i]); setAccepted(prev => prev.filter(x => x !== i)); }} style={{ padding: "8px 13px", border: "1px solid rgba(22,61,38,.24)", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}>Dismiss</button>
                </div>
              </div>
            );
          })}
        </aside>
      </div>
    </>
  );
}

// ─── Score screen ─────────────────────────────────────────────────────────────

const DIMS = [
  { label: "Quotability",      v: 84, note: "Most sections open with a liftable answer",    color: C.dark },
  { label: "Sourcing",         v: 58, note: "Two claims carry no attribution",               color: C.red },
  { label: "Structure",        v: 88, note: "Clean heading hierarchy, FAQ schema present",   color: C.dark },
  { label: "Entity coverage",  v: 61, note: "Brand entity mentioned once",                  color: C.red },
  { label: "Freshness",        v: 76, note: "One 2024 statistic could be updated",           color: C.mid },
  { label: "Prompt fit",       v: 80, note: "Answers the target and 3 adjacent prompts",     color: C.dark },
];

const RECS = [
  { tag: "SOURCING",   tagBg: "rgba(249,57,67,.1)",  lift: "+6 GEO · high confidence", title: "Attribute the retrieval claim",     body: "Unsourced assertions are the single biggest reason passages get skipped during retrieval.",  snippet: "In our sample of 4,100 answers, 71 percent of cited passages ran under 60 words." },
  { tag: "ENTITIES",   tagBg: "rgba(24,95,0,.1)",    lift: "+5 GEO · high confidence", title: "Name the brand entity twice more",  body: "Engines build confidence from repeated, consistent naming rather than pronouns.",           snippet: "AI To Market publishes its retention benchmarks quarterly." },
  { tag: "STRUCTURE",  tagBg: "rgba(22,61,38,.07)",  lift: "+4 GEO · medium",          title: "Add an answer block to the FAQ",    body: "The FAQ opens with context. Lead with the 25 word answer, then expand.",                    snippet: "GEO is optimization for generated answers rather than ranked links." },
  { tag: "FRESHNESS",  tagBg: "rgba(22,61,38,.07)",  lift: "+2 GEO · low",             title: "Update the 2024 statistic",         body: "Engines discount figures older than 18 months when a newer equivalent exists.",             snippet: "Replace with the 2026 answer engine usage figure." },
];

function ScoreScreen({ onEditor }: { onEditor: () => void }) {
  const [viz, setViz] = useState<VizMode>("ring");
  const liveScore = 71;
  const circumference = 2 * Math.PI * 52;
  const dash = `${(circumference * liveScore / 100).toFixed(1)} ${circumference.toFixed(1)}`;

  const heatRows = [
    ["Intro answer", 92, 78, 88, 70],
    ["GEO vs SEO",   84, 66, 74, 58],
    ["How engines pick", 71, 90, 62, 81],
    ["Checklist",    58, 44, 80, 39],
    ["FAQ",          40, 35, 55, 30],
  ];

  const vizBtnStyle = (key: VizMode): React.CSSProperties => ({
    whiteSpace: "nowrap", flexShrink: 0, padding: "8px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
    background: viz === key ? C.dark : "transparent", color: viz === key ? C.white : "rgba(22,61,38,.7)",
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, padding: 5, marginBottom: 32, border: "1px solid rgba(22,61,38,.16)", borderRadius: 10, width: "fit-content", background: C.white }}>
        {(["ring", "bars", "grid"] as VizMode[]).map(v => (
          <button key={v} onClick={() => setViz(v)} style={vizBtnStyle(v)}>
            {v === "ring" ? "Single dial" : v === "bars" ? "Dimension bars" : "Section heatmap"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 32, alignItems: "start" }}>
        <section style={{ padding: 32, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
          {viz === "ring" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              <div style={{ position: "relative", width: 208, height: 208 }}>
                <svg viewBox="0 0 120 120" width="208" height="208" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(22,61,38,.1)" strokeWidth="12" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke={C.dark} strokeWidth="12" strokeLinecap="round" strokeDasharray={dash} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, letterSpacing: -2, color: C.red }}>{liveScore}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: C.mid, marginTop: 8 }}>GEO SCORE</div>
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 400, lineHeight: 1.55, maxWidth: "38ch", color: "rgba(22,61,38,.72)" }}>Strong on structure and sourcing. Held back by thin entity coverage and one unsupported claim.</div>
            </div>
          )}
          {viz === "bars" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {DIMS.map(d => (
                <div key={d.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{d.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{d.v}</div>
                  </div>
                  <div style={{ height: 12, borderRadius: 7, background: "rgba(22,61,38,.09)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${d.v}%`, background: d.color }} />
                  </div>
                  <div style={{ marginTop: 7, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.62)" }}>{d.note}</div>
                </div>
              ))}
            </div>
          )}
          {viz === "grid" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: C.mid, marginBottom: 16 }}>SECTION BY DIMENSION</div>
              <div style={{ display: "grid", gridTemplateColumns: "120px repeat(4,1fr)", gap: 6 }}>
                <div />
                {["QUOTABILITY", "SOURCING", "STRUCTURE", "ENTITIES"].map(h => (
                  <div key={h} style={{ padding: "10px 8px", fontSize: 9, fontWeight: 700, color: C.mid, textAlign: "center" }}>{h}</div>
                ))}
                {heatRows.map(row => (
                  <div key={row[0] as string} style={{ display: "contents" }}>
                    <div style={{ padding: "14px 10px", fontSize: 12, fontWeight: 600, color: C.dark }}>{row[0]}</div>
                    {(row.slice(1) as number[]).map((v, j) => {
                      const a = v >= 80 ? 1 : v >= 65 ? 0.62 : v >= 50 ? 0.32 : 0.12;
                      return <div key={j} style={{ padding: "14px 10px", borderRadius: 6, background: a === 1 ? C.dark : `rgba(22,61,38,${a})`, color: a >= 0.62 ? C.white : C.dark, fontSize: 12, fontWeight: 700, textAlign: "center" }}>{v}</div>;
                    })}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.62)" }}>
                <span>Weak</span>
                {[.12, .32, .62, 1].map(a => <div key={a} style={{ width: 22, height: 10, borderRadius: 3, background: a === 1 ? C.dark : `rgba(22,61,38,${a})` }} />)}
                <span>Strong</span>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600 }}>Recommendations</h2>
          <p style={{ margin: "0 0 20px", fontSize: 12, fontWeight: 400, color: "rgba(22,61,38,.7)" }}>Ordered by predicted lift in citation probability.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {RECS.map(r => (
              <div key={r.title} style={{ padding: 20, border: "1px solid rgba(22,61,38,.13)", borderRadius: 11, background: C.white }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "3px 7px", borderRadius: 5, background: r.tagBg, color: C.dark }}>{r.tag}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(22,61,38,.62)" }}>{r.lift}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>{r.title}</div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 400, lineHeight: 1.55, color: "rgba(22,61,38,.72)" }}>{r.body}</div>
                <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: C.bg, fontSize: 12, fontWeight: 400, lineHeight: 1.5 }}>{r.snippet}</div>
                <button onClick={onEditor} style={{ marginTop: 14, padding: "8px 13px", borderRadius: 7, background: C.dark, color: C.white, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer" }}>Apply in editor</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Keywords screen ──────────────────────────────────────────────────────────

const CLUSTER_CARDS = [
  { name: "MECHANICS",   covered: "14 / 18", note: "Strongest cluster, 4 prompts open" },
  { name: "COMPARISON",  covered: "6 / 11",  note: "Competitor cited in 5 of the gaps" },
  { name: "MEASUREMENT", covered: "3 / 9",   note: "Highest opportunity per ask" },
  { name: "TOOLS",       covered: "1 / 7",   note: "Commercial intent, unclaimed" },
];

const PROMPT_ROWS = [
  { prompt: "what is generative engine optimization",  cluster: "Mechanics",   intent: "Informational",   volume: "3.1k", cov: 88 },
  { prompt: "how do answer engines choose sources",    cluster: "Mechanics",   intent: "Informational",   volume: "2.4k", cov: 24 },
  { prompt: "geo vs seo what is the difference",       cluster: "Comparison",  intent: "Comparative",     volume: "1.8k", cov: 61 },
  { prompt: "how to measure ai search visibility",     cluster: "Measurement", intent: "Practical",       volume: "980",  cov: 12 },
  { prompt: "best geo tools for b2b saas",             cluster: "Tools",       intent: "Commercial",      volume: "740",  cov: 0  },
  { prompt: "does schema markup help geo",             cluster: "Mechanics",   intent: "Technical",       volume: "610",  cov: 74 },
  { prompt: "why is my site not cited by chatgpt",     cluster: "Diagnostics", intent: "Troubleshooting", volume: "520",  cov: 38 },
  { prompt: "geo checklist for content teams",         cluster: "Playbook",    intent: "Practical",       volume: "410",  cov: 55 },
  { prompt: "how often do engines refresh sources",    cluster: "Mechanics",   intent: "Technical",       volume: "260",  cov: 19 },
];

function KeywordsScreen() {
  return (
    <div>
      <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
        {CLUSTER_CARDS.map(c => (
          <div key={c.name} style={{ flex: 1, padding: 20, border: `1px solid ${C.border}`, borderRadius: 11, background: C.white }}>
            <EyebrowLabel>{c.name}</EyebrowLabel>
            <div style={{ marginTop: 12, fontSize: 24, fontWeight: 700, letterSpacing: "-.6px" }}>{c.covered}</div>
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.65)" }}>{c.note}</div>
          </div>
        ))}
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2.6fr 1fr 1fr 1fr 1fr", gap: 16, padding: "14px 24px", background: "rgba(22,61,38,.04)", fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: C.mid }}>
          <div>PROMPT</div><div>CLUSTER</div><div>INTENT</div><div>MONTHLY ASKS</div><div>YOUR COVERAGE</div>
        </div>
        {PROMPT_ROWS.map(p => {
          const covFill = p.cov >= 60 ? C.mid : p.cov >= 25 ? C.dark : C.red;
          const covLabel = p.cov === 0 ? "None" : p.cov >= 60 ? "Strong" : p.cov >= 25 ? "Partial" : "Thin";
          return (
            <div key={p.prompt} style={{ display: "grid", gridTemplateColumns: "2.6fr 1fr 1fr 1fr 1fr", gap: 16, alignItems: "center", padding: "15px 24px", borderTop: "1px solid rgba(22,61,38,.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{p.prompt}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.mid }}>{p.cluster}</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "rgba(22,61,38,.7)" }}>{p.intent}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{p.volume}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 44, height: 6, borderRadius: 4, background: "rgba(22,61,38,.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p.cov}%`, background: covFill }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: covFill }}>{covLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Publish screen ───────────────────────────────────────────────────────────

const INTEGRATIONS = [
  { name: "WordPress",       initial: "W",  meta: "aitomarketgroup.com · 2 authors",  badge: "CONNECTED",  action: "Configure mapping" },
  { name: "Webflow",         initial: "Wf", meta: "Not connected",                    badge: "AVAILABLE",  action: "Connect" },
  { name: "HubSpot",         initial: "H",  meta: "Blog + campaign sync",             badge: "CONNECTED",  action: "Configure mapping" },
  { name: "Contentful",      initial: "C",  meta: "Not connected",                    badge: "AVAILABLE",  action: "Connect" },
  { name: "Schema injector", initial: "S",  meta: "FAQ, Article, Organization",       badge: "CONNECTED",  action: "Edit schema rules" },
  { name: "Slack",           initial: "Sl", meta: "#content-review approvals",        badge: "CONNECTED",  action: "Edit notifications" },
];

const PUBLISH_RULES = [
  { label: "Block publishing below GEO score 75",    box: C.dark },
  { label: "Require one human approval per article", box: C.dark },
  { label: "Inject FAQ and Article schema on push",  box: C.dark },
  { label: "Auto publish approved drafts on schedule", box: "transparent" },
];

function PublishScreen() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, alignItems: "start" }}>
      <section>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>Destinations</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {INTEGRATIONS.map(i => {
            const connected = i.badge === "CONNECTED";
            return (
              <div key={i.name} style={{ padding: 22, border: "1px solid rgba(22,61,38,.13)", borderRadius: 11, background: C.white }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9, border: "1px solid rgba(22,61,38,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: C.bg }}>{i.initial}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name}</div>
                    <div style={{ marginTop: 3, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.62)" }}>{i.meta}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "4px 8px", borderRadius: 5, background: connected ? "rgba(24,95,0,.1)" : "rgba(22,61,38,.06)", color: connected ? C.mid : "rgba(22,61,38,.6)" }}>{i.badge}</span>
                </div>
                <button style={{ width: "100%", marginTop: 16, padding: 9, border: "1px solid rgba(22,61,38,.24)", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}>{i.action}</button>
              </div>
            );
          })}
        </div>
      </section>
      <aside style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, position: "sticky", top: 180 }}>
        <EyebrowLabel>PUBLISH RULES</EyebrowLabel>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {PUBLISH_RULES.map(r => (
            <div key={r.label} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
              <span style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, borderRadius: 4, border: "1px solid rgba(22,61,38,.3)", background: r.box, display: "inline-block" }} />
              <div style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.5 }}>{r.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(22,61,38,.1)" }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Next scheduled push</div>
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 400, color: "rgba(22,61,38,.7)" }}>Thursday 09:00, 4 articles, WordPress plus schema injection.</div>
        </div>
      </aside>
    </div>
  );
}

// ─── Analytics screen ─────────────────────────────────────────────────────────

const CITATIONS_DATA = [
  { prompt: "how do answer engines choose sources",       article: "How answer engines select sources",          engine: "Perplexity",   when: "2h ago" },
  { prompt: "what is geo in marketing",                   article: "What is generative engine optimization?",   engine: "ChatGPT",      when: "5h ago" },
  { prompt: "geo vs seo",                                 article: "GEO vs SEO: what actually changed",         engine: "AI Overviews", when: "Yesterday" },
  { prompt: "does schema help ai search",                 article: "Schema markup for citability",              engine: "Claude",       when: "Yesterday" },
  { prompt: "measure ai visibility b2b",                  article: "Measuring AI search visibility",            engine: "Perplexity",   when: "2d ago" },
  { prompt: "generative engine optimization definition",  article: "What is generative engine optimization?",   engine: "Copilot",      when: "3d ago" },
];

function points(arr: number[]): string {
  const max = 120;
  return arr.map((v, i) => `${(i * (800 / (arr.length - 1))).toFixed(1)},${(219 - (v / max) * 210).toFixed(1)}`).join(" ");
}

const CHART_DATA: Record<string, [number[], number[]]> = {
  "4w":  [[52,58,61,74,79,88],        [44,45,47,48,49,51]],
  "12w": [[21,26,24,33,38,42,51,58,62,74,88,101], [26,27,29,30,32,34,36,38,40,42,44,47]],
  "12m": [[8,14,19,24,31,38,44,52,61,73,86,104],  [12,14,16,18,21,24,27,30,33,37,41,46]],
};

function AnalyticsScreen() {
  const [range, setRange] = useState("12w");
  const [chartA, chartB] = CHART_DATA[range];

  return (
    <div>
      <section style={{ padding: 28, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Citations captured, last 12 weeks</h2>
          <div style={{ display: "flex", gap: 6 }}>
            {["4w", "12w", "12m"].map(r => (
              <button key={r} onClick={() => setRange(r)} style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: range === r ? C.dark : "transparent", color: range === r ? C.white : "rgba(22,61,38,.7)", border: "none", cursor: "pointer" }}>{r}</button>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 800 220" width="100%" height="220" preserveAspectRatio="none">
          {[1, 73, 146, 219].map(y => <line key={y} x1="0" y1={y} x2="800" y2={y} stroke={y === 219 ? "rgba(22,61,38,.16)" : "rgba(22,61,38,.1)"} strokeWidth="1" />)}
          <polyline points={points(chartA)} fill="none" stroke={C.dark} strokeWidth="2.5" />
          <polyline points={points(chartB)} fill="none" stroke="rgba(22,61,38,.35)" strokeWidth="2" strokeDasharray="5 5" />
        </svg>
        <div style={{ display: "flex", gap: 24, marginTop: 16, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.68)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 2, background: C.dark, display: "inline-block" }} />Your citations</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 2, background: "rgba(22,61,38,.35)", display: "inline-block" }} />Category median</div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 28 }}>
        <section style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", fontSize: 13, fontWeight: 600, borderBottom: "1px solid rgba(22,61,38,.1)" }}>Recent citation log</div>
          {CITATIONS_DATA.map(c => (
            <div key={c.prompt} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 24px", borderBottom: "1px solid rgba(22,61,38,.07)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>{c.prompt}</div>
                <div style={{ marginTop: 5, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.62)" }}>{c.article}</div>
              </div>
              <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: C.mid }}>{c.engine}</div>
              <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.55)", width: 64, textAlign: "right" }}>{c.when}</div>
            </div>
          ))}
        </section>

        <section style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.dark, color: C.white }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", opacity: .75 }}>HEADLINE</div>
          <div style={{ marginTop: 16, fontSize: 32, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-.8px" }}>Citations up <span style={{ color: C.salmon }}>2.4x</span> since April</div>
          <p style={{ margin: "20px 0 0", fontSize: 13, fontWeight: 400, lineHeight: 1.6, opacity: .85 }}>Articles scoring above 80 are cited four times more often than those in the 60s. The queue now blocks publishing below 75.</p>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.18)", display: "flex", flexDirection: "column", gap: 12 }}>
            {[["Articles above 80", "17 of 41"], ["Median time to first citation", "9 days"], ["Prompts newly owned", "6 this month"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, fontWeight: 400 }}>
                <span style={{ opacity: .75 }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Settings screen ──────────────────────────────────────────────────────────

const BANNED_WORDS = ["unlock", "game changer", "revolutionary", "leverage", "supercharge", "seamless"];
const GUARDRAILS = [
  { label: "Never claim a number without a source",          box: C.dark },
  { label: "No product mentions before the final section",   box: C.dark },
  { label: "Flag any sentence over 30 words",                box: "transparent" },
];

function SettingsScreen() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 32, alignItems: "start" }}>
      <section style={{ padding: 32, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
        <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 600 }}>Brand voice</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: C.mid, marginBottom: 8 }}>HOUSE DESCRIPTION</label>
            <textarea rows={4} defaultValue="Calm, premium, declarative. We explain before we sell. No hype, no exclamation marks, no jargon we would not say out loud to a CFO." style={{ width: "100%", padding: 14, border: "1px solid rgba(22,61,38,.24)", borderRadius: 8, fontSize: 13, fontWeight: 400, lineHeight: 1.6, color: C.dark, background: C.bg, resize: "vertical", outline: "none" }} />
          </div>
          {VOICE_DIALS.map(v => (
            <div key={v.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                <span>{v.label}</span><span style={{ fontWeight: 400, color: "rgba(22,61,38,.65)" }}>{v.value}</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "rgba(22,61,38,.1)", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v.pct}%`, background: C.dark, borderRadius: 4 }} />
                <div style={{ position: "absolute", left: `${v.pct}%`, top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: "50%", background: C.white, border: `2px solid ${C.dark}` }} />
              </div>
            </div>
          ))}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: C.mid, marginBottom: 8 }}>NEVER USE</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BANNED_WORDS.map(w => (
                <span key={w} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 20, border: "1px solid rgba(22,61,38,.2)", fontSize: 12, fontWeight: 600 }}>{w}<span style={{ fontSize: 12, fontWeight: 400, color: "rgba(22,61,38,.5)" }}>×</span></span>
              ))}
            </div>
          </div>
        </div>
      </section>
      <aside style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 180 }}>
        <div style={{ padding: 22, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
          <EyebrowLabel>SAMPLE SENTENCE</EyebrowLabel>
          <p style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 400, lineHeight: 1.6 }}>Answer engines cite sources that state a position in one sentence. Most B2B blogs take four paragraphs to get there.</p>
          <div style={{ marginTop: 16, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.6)" }}>Regenerated from your current dials.</div>
        </div>
        <div style={{ padding: 22, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
          <EyebrowLabel>GUARDRAILS</EyebrowLabel>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {GUARDRAILS.map(g => (
              <div key={g.label} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <span style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, borderRadius: 4, border: "1px solid rgba(22,61,38,.3)", background: g.box, display: "inline-block" }} />
                <div style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.5 }}>{g.label}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─── Usage screen (v2-native, independent of v1) ─────────────────────────────

interface V2UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedUsd: number;
  totalCalls: number;
  byFeature: { feature: string; calls: number; estimatedUsd: number; tokens: number }[];
  byDay: { date: string; estimatedUsd: number; calls: number }[];
}

const FEATURE_NAMES: Record<string, string> = {
  "content-forge/create":       "Content Forge — Create",
  "content-forge/blog":         "Content Forge — Blog",
  "content-forge/linkedin":     "Content Forge — LinkedIn",
  "illustration":               "Illustration Generation",
  "article-outline":            "Article Outline",
  "article-draft":              "Article Draft",
  "article-refine":             "Article Refine",
  "article-chat":               "Article Builder Chat",
  "article-section-revise":     "Section Revision",
  "article-selection-rewrite":  "Selection Rewrite",
  "geo-metadata":               "GEO Metadata",
  "geo-fix":                    "GEO Fix",
  "ai-suggest":                 "AI Suggest",
  "identity-analysis":          "Identity Analysis",
  "opportunity-generate":       "Opportunity Generation",
};

function fmtUsd(n: number) { return n < 0.01 ? "<$0.01" : `$${n.toFixed(4)}`; }
function fmtTok(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function UsageScreen({ budget, onBudgetChange }: { budget: number; onBudgetChange: (n: number) => void }) {
  const [data, setData] = useState<V2UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [budgetInput, setBudgetInput] = useState(String(budget));

  // Sync budget from server on mount
  useEffect(() => {
    fetch("/api/usage/budget")
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json && typeof json.budget === "number" && json.budget > 0) {
          setBudgetInput(String(json.budget));
          if (json.budget !== budget) onBudgetChange(json.budget);
        }
      })
      .catch(() => { /* keep localStorage value */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(d: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usage?days=${d}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as V2UsageSummary);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(days); }, [days]);

  const totalTokens = data ? data.totalInputTokens + data.totalOutputTokens : 0;
  const maxDayUsd = data?.byDay.length ? Math.max(...data.byDay.map(d => d.estimatedUsd), 0.0001) : 0.0001;

  const pill = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? C.dark : C.border}`, background: active ? C.dark : "transparent", color: active ? C.white : C.muted, cursor: "pointer" }}>
      {label}
    </button>
  );

  const statTile = (label: string, value: string, sub: string) => (
    <div style={{ flex: 1, padding: "20px 24px", background: C.white, borderRadius: 12, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", opacity: .55, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", color: C.dark }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16 }}>
        <div>
          {lastRefreshed && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              Last refreshed: {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {lastRefreshed.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pill("7d", days === 7, () => setDays(7))}
          {pill("30d", days === 30, () => setDays(30))}
          {pill("90d", days === 90, () => setDays(90))}
          <button onClick={() => load(days)} style={{ padding: "5px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer" }}>
            ↻
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#FFF0F0", border: "1px solid rgba(249,57,67,.25)", color: C.red, fontSize: 13, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div style={{ padding: "60px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>Loading…</div>
      )}

      {data && (
        <>
          {/* Stat tiles */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            {statTile("ESTIMATED SPEND", `$${data.totalEstimatedUsd.toFixed(4)}`, `last ${days} days`)}
            {statTile("TOTAL TOKENS", fmtTok(totalTokens), `${fmtTok(data.totalInputTokens)} in · ${fmtTok(data.totalOutputTokens)} out`)}
            {statTile("API CALLS", data.totalCalls.toLocaleString(), "logged requests")}
          </div>

          {/* Budget warning / block banners */}
          {(() => {
            const activeBudget = parseInt(budgetInput, 10) || budget;
            const pct = activeBudget > 0 ? (data.totalCalls / activeBudget) * 100 : 100;
            if (pct >= 100) return (
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "#FFF0F0", border: "1px solid rgba(249,57,67,.35)", color: C.red, fontSize: 13, fontWeight: 600, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>🚫</span>
                <span>Monthly call limit reached — all AI features are currently blocked. Raise the budget below to resume.</span>
              </div>
            );
            if (pct >= 80) return (
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "#FFFBF0", border: "1px solid rgba(245,166,35,.45)", color: "#92600A", fontSize: 13, fontWeight: 500, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span>Approaching your monthly limit — {data.totalCalls} of {activeBudget} calls used ({pct.toFixed(0)}%). Raise the budget below if needed.</span>
              </div>
            );
            return null;
          })()}

          {/* Daily chart */}
          {data.byDay.length > 0 && (
            <div style={{ padding: "20px 24px", background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", opacity: .55, marginBottom: 16 }}>DAILY SPEND</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 72 }}>
                {data.byDay.map(d => {
                  const pct = (d.estimatedUsd / maxDayUsd) * 100;
                  const label = d.date.slice(5);
                  return (
                    <div key={d.date} title={`${label}: ${fmtUsd(d.estimatedUsd)}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{ width: "100%", height: `${Math.max(pct, 2)}%`, background: C.mid, borderRadius: "3px 3px 0 0", opacity: .75 }} />
                      {data.byDay.length <= 10 && <div style={{ fontSize: 9, color: C.muted, lineHeight: 1 }}>{label}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature breakdown */}
          {data.byFeature.length > 0 ? (
            <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", opacity: .55 }}>COST BY FEATURE</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Feature", "Calls", "Tokens", "Est. Cost", "Share"].map(h => (
                      <th key={h} style={{ padding: "10px 24px", textAlign: h === "Feature" ? "left" : "right", fontSize: 11, fontWeight: 600, letterSpacing: ".06em", color: C.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byFeature.map((f, i) => {
                    const share = data.totalEstimatedUsd > 0 ? (f.estimatedUsd / data.totalEstimatedUsd) * 100 : 0;
                    return (
                      <tr key={f.feature} style={{ borderBottom: i < data.byFeature.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <td style={{ padding: "12px 24px", fontWeight: 500 }}>{FEATURE_NAMES[f.feature] ?? f.feature}</td>
                        <td style={{ padding: "12px 24px", textAlign: "right", color: C.muted, fontVariantNumeric: "tabular-nums" }}>{f.calls}</td>
                        <td style={{ padding: "12px 24px", textAlign: "right", color: C.muted, fontVariantNumeric: "tabular-nums" }}>{fmtTok(f.tokens)}</td>
                        <td style={{ padding: "12px 24px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtUsd(f.estimatedUsd)}</td>
                        <td style={{ padding: "12px 24px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                            <div style={{ width: 80, height: 4, borderRadius: 4, background: C.faint, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${share.toFixed(1)}%`, background: C.mid, borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: 11, color: C.muted, minWidth: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{share.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "48px 24px", textAlign: "center", background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, color: C.muted, fontSize: 13 }}>
              No usage recorded in the last {days} days.<br />Usage is tracked automatically as you use AI features.
            </div>
          )}

          {/* Budget setting */}
          <div style={{ marginTop: 24, padding: "20px 24px", background: C.white, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", opacity: .55, marginBottom: 16 }}>MONTHLY BUDGET</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Call limit per month</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                  Controls the progress bar in the sidebar. The bar turns full when API calls hit this number.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  style={{ width: 96, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, fontFamily: "Montserrat, Arial, sans-serif", color: C.dark, background: C.bg, outline: "none" }}
                />
                <button
                  onClick={() => {
                    const n = parseInt(budgetInput, 10);
                    if (n > 0) onBudgetChange(n);
                  }}
                  style={{ padding: "8px 18px", borderRadius: 8, background: C.dark, color: C.white, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Montserrat, Arial, sans-serif" }}
                >
                  Save
                </button>
              </div>
            </div>
            {/* Live preview of the bar */}
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 4, background: "rgba(22,61,38,.1)", overflow: "hidden" }}>
                {(() => {
                  const activeBudget = parseInt(budgetInput, 10) || budget;
                  const pct = Math.min(((data?.totalCalls ?? 0) / activeBudget) * 100, 100);
                  return <div style={{ height: "100%", width: `${pct}%`, background: creditBarColor(pct), borderRadius: 4, transition: "width .3s, background .3s" }} />;
                })()}
              </div>
              <div style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {data?.totalCalls ?? 0} of {parseInt(budgetInput, 10) || budget} calls
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: C.muted }}>
            Token counts are exact values from the API. Costs use OpenAI list pricing — verify at platform.openai.com/usage.
          </div>
        </>
      )}
    </div>
  );
}

// ─── Trash screen ────────────────────────────────────────────────────────────

function TrashScreen({ trashedCards, onRestore, onDeletePermanently, onEmptyTrash }: {
  trashedCards: DraftCard[];
  onRestore: (id: string) => void;
  onDeletePermanently: (id: string) => void;
  onEmptyTrash: () => void;
}) {
  if (trashedCards.length === 0) {
    return (
      <div style={{ maxWidth: 440, margin: "80px auto", textAlign: "center", padding: "48px 40px", border: "1px dashed rgba(22,61,38,.22)", borderRadius: 16, background: C.white }}>
        <div style={{ width: 48, height: 48, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(22,61,38,.18)", borderRadius: "50%" }}>
          <svg viewBox="0 0 20 20" width="20" height="20"><path d="M7 3h6v2H7zM3 5h14v2H3zM5 7h10l-1 10H6L5 7z" fill={C.muted} /></svg>
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Trash is empty</h2>
        <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 400, lineHeight: 1.55, color: C.muted }}>Removed cards will appear here. You can restore them or delete permanently.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.mid, marginBottom: 8 }}>TRASH</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.3px" }}>
            {trashedCards.length} deleted brief{trashedCards.length !== 1 ? "s" : ""}
          </h2>
        </div>
        <button
          onClick={onEmptyTrash}
          style={{ padding: "9px 16px", border: "1px solid rgba(249,57,67,.35)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(249,57,67,.05)", color: C.red, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Empty trash
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {trashedCards.map(card => (
          <div key={card.opportunityId} style={{ padding: 24, border: "1px solid rgba(22,61,38,.09)", borderRadius: 12, background: C.white, opacity: 0.82, display: "flex", flexDirection: "column", minHeight: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "rgba(22,61,38,.4)", marginBottom: 12 }}>DELETED</div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: C.dark, flex: 1, marginBottom: 10 }}>
              {card.brief.prompt ?? "Untitled brief"}
            </div>
            {card.brief.format && (
              <div style={{ fontSize: 12, fontWeight: 400, color: C.muted, marginBottom: 6 }}>{card.brief.format}</div>
            )}
            {card.brief.client && (
              <div style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 12, background: C.faint, color: C.dark, width: "fit-content", marginBottom: 6 }}>{card.brief.client}</div>
            )}
            <div style={{ fontSize: 11, color: "rgba(22,61,38,.38)", marginTop: 12, marginBottom: 16, paddingTop: 12, borderTop: "1px solid rgba(22,61,38,.07)" }}>
              {timeAgo(card.createdAt)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => onRestore(card.opportunityId)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(22,61,38,.28)", fontSize: 12, fontWeight: 600, background: "none", cursor: "pointer", color: C.dark }}
              >
                Restore
              </button>
              <button
                onClick={() => onDeletePermanently(card.opportunityId)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(249,57,67,.3)", fontSize: 12, fontWeight: 600, background: "rgba(249,57,67,.05)", color: C.red, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────

const BUDGET_KEY        = "v2_monthly_call_budget";
const TRASHED_CARDS_KEY = "v2_trashed_cards";

function readBudget(): number {
  try { return Math.max(1, Number(localStorage.getItem(BUDGET_KEY) ?? "200") || 200); }
  catch { return 200; }
}
function readTrashedCards(): DraftCard[] {
  try { return JSON.parse(localStorage.getItem(TRASHED_CARDS_KEY) ?? "[]") as DraftCard[]; }
  catch { return []; }
}
function saveTrashedCards(cards: DraftCard[]) {
  try { localStorage.setItem(TRASHED_CARDS_KEY, JSON.stringify(cards)); }
  catch {}
}

export default function AtelierV2Page() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [dataState] = useState<DataState>("normal");
  const [currentOpportunityId, setCurrentOpportunityId] = useState<string | null>(null);
  const [draftCards, setDraftCards] = useState<DraftCard[]>([]);
  const [trashedCards, setTrashedCards] = useState<DraftCard[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [generateDefaultFlow, setGenerateDefaultFlow] = useState<FlowMode>("wizard");
  const { data: settings } = useSettings();

  // Load trashed cards from localStorage on mount
  useEffect(() => { setTrashedCards(readTrashedCards()); }, []);

  // Load existing sessions from DB on mount — filter out trashed ones
  useEffect(() => {
    const trashedIds = new Set(readTrashedCards().map(c => c.opportunityId));
    fetch("/api/builder-sessions")
      .then(r => r.ok ? r.json() as Promise<Array<{ opportunityId: string; topicTitle: string; createdAt: string }>> : null)
      .then(sessions => {
        if (!sessions?.length) return;
        const sorted = [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setDraftCards(prev => {
          const existingIds = new Set(prev.map(c => c.opportunityId));
          const toAdd = sorted
            .filter(s => !existingIds.has(s.opportunityId) && !trashedIds.has(s.opportunityId))
            .map(s => ({
              opportunityId: s.opportunityId,
              brief: { prompt: s.topicTitle } as BriefFields,
              createdAt: s.createdAt,
            }));
          return [...prev, ...toAdd];
        });
      })
      .catch(() => {});
  }, []);

  function handleSessionCreated(opportunityId: string, brief: BriefFields) {
    setCurrentOpportunityId(opportunityId);
    setDraftCards(prev => [...prev, { opportunityId, brief, createdAt: new Date().toISOString() }]);
    setActiveCardId(null);
    setScreen("editor");
  }

  function handleActivateCard(id: string) { setActiveCardId(id); }

  function handleBackToCards() {
    setActiveCardId(null);
    if (draftCards.length === 0) setScreen("generate");
  }

  function handleResumeChat() {
    setGenerateDefaultFlow("chat");
    setScreen("generate");
  }

  function handleTrashCard(id: string) {
    const card = draftCards.find(c => c.opportunityId === id);
    if (!card) return;
    const newDraft = draftCards.filter(c => c.opportunityId !== id);
    const newTrashed = [card, ...trashedCards];
    setDraftCards(newDraft);
    setTrashedCards(newTrashed);
    saveTrashedCards(newTrashed);
    if (activeCardId === id) setActiveCardId(null);
    if (newDraft.length === 0) setActiveCardId(null);
  }

  function handleRestoreCard(id: string) {
    const card = trashedCards.find(c => c.opportunityId === id);
    if (!card) return;
    const newTrashed = trashedCards.filter(c => c.opportunityId !== id);
    setDraftCards(prev => [card, ...prev]);
    setTrashedCards(newTrashed);
    saveTrashedCards(newTrashed);
  }

  function handleDeletePermanently(id: string) {
    const newTrashed = trashedCards.filter(c => c.opportunityId !== id);
    setTrashedCards(newTrashed);
    saveTrashedCards(newTrashed);
  }

  function handleEmptyTrash() {
    setTrashedCards([]);
    saveTrashedCards([]);
  }

  // ── Budget (persisted locally, independent of v1) ─────────────────────────
  const [budget, setBudget] = useState<number>(200);

  useEffect(() => { setBudget(readBudget()); }, []);

  function handleBudgetChange(n: number) {
    setBudget(n);
    try { localStorage.setItem(BUDGET_KEY, String(n)); } catch {}
    void fetch("/api/usage/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ budget: n }) })
      .catch(() => { /* non-fatal — localStorage is the fast local cache */ });
  }

  // ── AI usage (v2-local fetch, independent of v1) ──────────────────────────
  const [monthlyCallCount, setMonthlyCallCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/usage?days=30")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && typeof json.totalCalls === "number") {
          setMonthlyCallCount(json.totalCalls);
        }
      })
      .catch(() => { /* silently ignore — sidebar just stays at 0 */ });
  }, []);

  const creditCount = monthlyCallCount ?? 0;
  const creditPct   = Math.min((creditCount / budget) * 100, 100);
  const creditLabel = `${creditCount} of ${budget} used this month`;

  const go = (s: Screen) => () => setScreen(s);

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Montserrat, Arial, sans-serif", color: C.dark, background: C.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        button:hover { opacity: 0.88; }
        @keyframes pulse { 0%,100%{opacity:.35}50%{opacity:.7} }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: rgba(22,61,38,.18); border-radius: 8px; }
      `}</style>

      <Sidebar
        screen={screen}
        setScreen={setScreen}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        creditPct={creditPct}
        creditLabel={creditLabel}
        onUsageClick={() => setScreen("usage")}
      />

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <PageHeader screen={screen} onGenerate={go("generate")} onKeywords={go("keywords")} />

        <div style={{ flex: 1, padding: "32px 40px 64px" }}>
          {screen === "dashboard"  && <DashboardScreen dataState={dataState} onGenerate={go("generate")} onQueue={go("queue")} onEditor={go("editor")} onAnalytics={go("analytics")} />}
          {screen === "generate"   && <GenerateScreen onSettings={go("settings")} onQueue={go("queue")} onSessionCreated={handleSessionCreated} seedKeywords={settings?.seed_keywords ?? []} defaultFlow={generateDefaultFlow} />}
          {screen === "queue"      && <QueueScreen onEditor={go("editor")} onGenerate={go("generate")} />}
          {screen === "editor"     && <EditorScreen onScore={go("score")} onPublish={go("publish")} draftCards={draftCards} activeCardId={activeCardId} onActivateCard={handleActivateCard} onBackToCards={handleBackToCards} onResumeChat={handleResumeChat} onTrashCard={handleTrashCard} />}
          {screen === "score"      && <ScoreScreen onEditor={go("editor")} />}
          {screen === "keywords"   && <KeywordsScreen />}
          {screen === "publish"    && <PublishScreen />}
          {screen === "analytics"  && <AnalyticsScreen />}
          {screen === "settings"   && <SettingsScreen />}
          {screen === "usage"      && <UsageScreen budget={budget} onBudgetChange={handleBudgetChange} />}
          {screen === "trash"      && <TrashScreen trashedCards={trashedCards} onRestore={handleRestoreCard} onDeletePermanently={handleDeletePermanently} onEmptyTrash={handleEmptyTrash} />}
        </div>
      </main>
    </div>
  );
}

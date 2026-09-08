"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
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
  creatorEmail?: string;
}

interface PresenceUser {
  user_id: string;
  user_email: string;
  active_card_id: string | null;
}

interface V2OutlineSection {
  order: number;
  type: string;
  title: string;
  eyebrow?: string;
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


// ─── Per-card autosave cache ──────────────────────────────────────────────────

const CARD_CACHE_PREFIX = "v2_card_";

interface V2CardCache {
  editorStep: "plan" | "article";
  outline: V2OutlineSection[];
  articleTitle: string;
  articleData: GeneratedArticle | null;
  geoScore: { score: number; checks: { label: string; pass: boolean; evidence: string }[]; wordCount: number } | null;
  qualityFlags: { section?: string; type: string; message: string }[];
  brandVoiceStatus: { status: string; residuals?: { paragraphIndex: number; violations: { type: string; match: string }[] }[] } | null;
  seoPageTitle: string;
  seoTitle: string;
  seoSlug: string;
  seoMetaDesc: string;
  seoTags: string[];
  articleFinalised?: boolean;
  seoExcerpt?: string;
  seoFocusKeyword?: string;
  draftSentAt?: string;
  savedAt: string;
}

function readCardCache(id: string): V2CardCache | null {
  try { return JSON.parse(localStorage.getItem(CARD_CACHE_PREFIX + id) ?? "null") as V2CardCache | null; }
  catch { return null; }
}
function writeCardCache(id: string, data: V2CardCache) {
  try { localStorage.setItem(CARD_CACHE_PREFIX + id, JSON.stringify(data)); }
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

function sectionSlug(heading: string): string {
  return "nl-sec-" + heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

// Bar uses a fixed gradient track; fill width reveals it left-to-right
const CREDIT_BAR_GRADIENT = "linear-gradient(to right, #39FF14 0%, #FFD700 50%, #FF2020 100%)";

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
        {NAV_ITEMS.map(([key, label, d, badge]) => {
          const isActive = screen === key;
          return (
            <button
              key={key}
              onClick={() => setScreen(key)}
              title={collapsed ? label : undefined}
              className={`v2-nav-btn${isActive ? " v2-nav-active" : ""}${collapsed ? " v2-nav-collapsed" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: collapsed ? 0 : 11, justifyContent: collapsed ? "center" : "flex-start", width: "100%", textAlign: "left", padding: collapsed ? "10px 0" : "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: isActive ? 600 : 400, background: isActive ? "rgba(255,255,255,.16)" : "transparent", color: C.white, border: "none", cursor: "pointer" }}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" className="v2-nav-icon" style={{ flexShrink: 0, opacity: isActive ? 1 : .6 }}><path d={d} fill="currentColor" /></svg>
              {!collapsed && <span className="v2-nav-label" style={{ flex: 1, whiteSpace: "nowrap" }}>{label}</span>}
              {!collapsed && badge && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "rgba(255,255,255,.16)", transition: "transform .14s ease" }} className="v2-nav-label">{badge}</span>}
            </button>
          );
        })}
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
              <div style={{ height: "100%", width: `${creditPct}%`, background: CREDIT_BAR_GRADIENT, backgroundSize: `${(10000 / Math.max(creditPct, 0.1)).toFixed(0)}% 100%` }} />
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: 8, padding: "10px 12px", transition: "background .15s", background: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.5 }}>Monthly generation credits</div>
            <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,.18)", margin: "10px 0 6px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${creditPct}%`, background: CREDIT_BAR_GRADIENT, backgroundSize: `${(10000 / Math.max(creditPct, 0.1)).toFixed(0)}% 100%`, transition: "width .3s" }} />
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

const AVATAR_COLORS = ["#185F00", "#163D26", "#1a5276", "#6e2f8a", "#7d3c0e", "#1a6b4a"];

function avatarInitial(email: string) {
  return (email.split("@")[0]?.[0] ?? "?").toUpperCase();
}

function avatarColor(email: string) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function UserAvatar({ email, size = 24 }: { email: string; size?: number }) {
  return (
    <div title={email} style={{ width: size, height: size, borderRadius: "50%", background: avatarColor(email), color: "#fff", fontSize: size * 0.42, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid #fff" }}>
      {avatarInitial(email)}
    </div>
  );
}

function DraftCardComponent({ card, onCreateArticle, onResume, onRemove, activeUsers, hasSavedPlan, sentToSanity, hasArticle }: {
  card: DraftCard;
  onCreateArticle: () => void;
  onResume?: () => void;
  onRemove?: () => void;
  activeUsers?: PresenceUser[];
  hasSavedPlan?: boolean;
  sentToSanity?: boolean;
  hasArticle?: boolean;
}) {
  const rawScore = card.brief.predictedScore ? parseInt(card.brief.predictedScore) : NaN;
  const scoreNum = isNaN(rawScore) ? null : rawScore;
  const hasActive = activeUsers && activeUsers.length > 0;

  return (
    <div style={{ padding: 24, border: `1px solid ${hasActive ? "rgba(24,95,0,.35)" : C.border}`, borderRadius: 12, background: hasActive ? "rgba(24,95,0,.04)" : C.white, display: "flex", flexDirection: "column", height: 300, position: "relative", boxShadow: hasActive ? "0 0 0 2px rgba(24,95,0,.18)" : "none" }}>
      {/* X remove button — hidden when locked */}
      {onRemove && !hasActive && (
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
        {hasActive ? (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: C.mid, background: "rgba(24,95,0,.12)", padding: "4px 9px", borderRadius: 20 }}>
            🔒 {activeUsers![0].user_email.split("@")[0].toUpperCase()} IS EDITING
          </span>
        ) : sentToSanity ? (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "#185F00", background: "rgba(24,95,0,.13)", padding: "4px 9px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 }}>
            <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>
            SENT TO SANITY
          </span>
        ) : hasArticle ? (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "#185F00", background: "rgba(24,95,0,.1)", padding: "4px 9px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 }}>
            <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>
            ARTICLE SAVED
          </span>
        ) : hasSavedPlan ? (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "#185F00", background: "rgba(24,95,0,.12)", padding: "4px 9px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 }}>
            <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>
            PLAN SAVED
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "#888", background: "#E8E8E8", padding: "4px 9px", borderRadius: 20 }}>READY TO BUILD</span>
        )}
        {scoreNum !== null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: scoreColor(scoreNum) }}>{scoreNum}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginTop: 2 }}>/ 100</div>
          </div>
        )}
      </div>

      {/* Prompt (title) */}
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: C.dark, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer: timestamp + creator + active users */}
      <div style={{ paddingTop: 12, borderTop: "1px solid rgba(22,61,38,.08)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.42)" }}>{timeAgo(card.createdAt)}</span>
            {card.creatorEmail && (
              <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(22,61,38,.38)" }}>{card.creatorEmail.split("@")[0]}</span>
            )}
          </div>
          {hasActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.mid, animation: "pulse 2s infinite" }} />
              <div style={{ display: "flex" }}>
                {activeUsers!.slice(0, 3).map(u => <UserAvatar key={u.user_id} email={u.user_email} size={22} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        {(sentToSanity || hasArticle) ? (
          <button
            onClick={onCreateArticle}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            View Article
          </button>
        ) : hasSavedPlan && !hasActive ? (
          <>
            <button
              onClick={onCreateArticle}
              style={{ flex: 1, padding: "11px 14px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              Resume Plan
            </button>
            <button
              onClick={onCreateArticle}
              title="Regenerate from scratch"
              style={{ padding: "11px 14px", borderRadius: 8, background: "transparent", color: C.muted, fontSize: 12, fontWeight: 500, border: `1px solid ${C.border}`, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Regenerate
            </button>
          </>
        ) : (
          <button
            onClick={onCreateArticle}
            disabled={hasActive}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 8, background: hasActive ? "rgba(22,61,38,.25)" : C.dark, color: C.white, fontSize: 12, fontWeight: 600, border: "none", cursor: hasActive ? "not-allowed" : "pointer", opacity: hasActive ? 0.8 : 1 }}
          >
            {hasActive ? "🔒 Locked" : "Create Article"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Article types ────────────────────────────────────────────────────────────

interface ArticleParagraph { id: number; text: string; }
interface ArticleSectionContent { paragraphs: ArticleParagraph[]; bullets: string[]; }
interface GeneratedSection { order: number; type: string; heading: string; eyebrow?: string; content: ArticleSectionContent; }
interface GeneratedArticle { title: string; sections: GeneratedSection[]; }

// ─── Newsletter article renderer ──────────────────────────────────────────────

function ImgPlaceholder({ height = 200 }: { height?: number }) {
  return (
    <div style={{ width: "100%", height, background: "rgba(22,61,38,.07)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(22,61,38,.22)" strokeWidth="1.5" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
      </svg>
    </div>
  );
}


// Renders a paragraph that may contain LLM-emitted HTML (lists, bold, etc.)
const HTML_TAG_RE = /<[a-z][\s\S]*?>/i;

// ── AI-tell phrase replacement (mirrors geo-score.ts phrase lists) ─────────────
function fixAiTells(text: string): string {
  let t = text;
  // Category 1: Significance inflation
  const pairs: [RegExp, string][] = [
    [/serves?\s+as\s+a\s+testament\s+to/gi, "demonstrates"],
    [/stands?\s+as\s+a\s+testament\s+to/gi, "demonstrates"],
    [/is\s+a\s+testament\s+to/gi, "demonstrates"],
    [/marks?\s+a\s+pivotal\s+moment/gi, "represents a turning point"],
    [/marks?\s+a\s+significant\s+shift/gi, "signals a shift"],
    [/represents?\s+a\s+significant\s+milestone/gi, "is a milestone"],
    [/underscores?\s+its\s+importance/gi, "matters"],
    [/underscores?\s+the\s+importance\s+of/gi, "highlights"],
    [/highlights?\s+the\s+significance\s+of/gi, "shows the significance of"],
    [/highlights?\s+the\s+need\s+for/gi, "shows the need for"],
    [/reinforces?\s+the\s+notion\s+that/gi, "confirms that"],
    [/demonstrates?\s+the\s+value\s+of/gi, "shows the value of"],
    [/emphasizes?\s+the\s+need\s+for/gi, "shows the need for"],
    [/speaks\s+volumes/gi, "reveals much"],
    [/paves?\s+the\s+way\s+for/gi, "enables"],
    [/brings?\s+to\s+light/gi, "reveals"],
    [/sheds?\s+light\s+on/gi, "clarifies"],
    [/serves?\s+as\s+a\s+reminder/gi, "reminds us"],
    // Category 2: Dangling participials (comma-attached trailing clauses)
    [/,\s*highlighting\b/gi, ". This highlights"],
    [/,\s*underscoring\b/gi, ". This underscores"],
    [/,\s*reflecting\b/gi, ", which reflects"],
    [/,\s*showcasing\b/gi, ", showing"],
    [/,\s*demonstrating\b/gi, ". This demonstrates"],
    [/,\s*emphasizing\b/gi, ". This emphasizes"],
    [/,\s*illustrating\b/gi, ". This illustrates"],
    [/,\s*reinforcing\b/gi, ". This reinforces"],
    [/,\s*signaling\b/gi, ". This signals"],
    // Category 3: Vague attribution
    [/industry\s+observers\s+have\s+noted/gi, "reports show"],
    [/industry\s+observers\s+note/gi, "reports show"],
    [/experts\s+say/gi, "data shows"],
    [/experts\s+note/gi, "practitioners note"],
    [/experts\s+agree/gi, "the data shows"],
    [/many\s+experts/gi, "practitioners"],
    [/thought\s+leaders/gi, "senior practitioners"],
    [/it\s+is\s+widely\s+believed/gi, "evidence shows"],
    [/it\s+is\s+well\s+known/gi, "data confirms"],
    [/it\s+is\s+widely\s+recognized/gi, "data shows"],
    [/the\s+consensus\s+is/gi, "data suggests"],
    [/many\s+believe/gi, "evidence suggests"],
    [/analysts\s+note/gi, "per industry research"],
    [/analysts\s+say/gi, "per industry research"],
    // Category 4: Signposting
    [/let['']s\s+dive\s+in[,.]?\s*/gi, ""],
    [/let\s+us\s+dive\s+in[,.]?\s*/gi, ""],
    [/let['']s\s+dive\s+into\b/gi, "looking at"],
    [/let\s+us\s+dive\s+into\b/gi, "looking at"],
    [/let['']s\s+explore\b/gi, "here's what matters:"],
    [/let\s+us\s+explore\b/gi, "here's what matters:"],
    [/let['']s\s+take\s+a\s+look\b/gi, "looking at the data"],
    [/let\s+us\s+take\s+a\s+look\b/gi, "looking at the data"],
    [/here['']s\s+what\s+you\s+need\s+to\s+know[,:]?\s*/gi, ""],
    [/here\s+is\s+what\s+you\s+need\s+to\s+know[,:]?\s*/gi, ""],
    [/here['']s\s+everything\s+you\s+need\s+to\s+know[,:]?\s*/gi, ""],
    [/here\s+is\s+everything\s+you\s+need\s+to\s+know[,:]?\s*/gi, ""],
    [/we['']ll\s+cover\b/gi, "this covers"],
    [/we\s+will\s+cover\b/gi, "this covers"],
    [/we['']ll\s+explore\b/gi, "this examines"],
    [/we\s+will\s+explore\b/gi, "this examines"],
    [/without\s+further\s+ado[,.]?\s*/gi, ""],
    [/keep\s+reading\s+to\b/gi, "below,"],
    [/read\s+on\s+to\s+learn\b/gi, "below,"],
    // Category 5: Restatement openers
    [/this\s+section\s+covers[^.]{0,80}\.\s*/gi, ""],
    [/this\s+section\s+explains[^.]{0,80}\.\s*/gi, ""],
    [/this\s+section\s+will\s+cover[^.]{0,80}\.\s*/gi, ""],
    [/this\s+section\s+walks\s+you\s+through[^.]{0,80}\.\s*/gi, ""],
    [/in\s+this\s+section,?\s+we[^.]{0,80}\.\s*/gi, ""],
    [/this\s+article\s+explores[^.]{0,80}\.\s*/gi, ""],
    [/this\s+article\s+covers[^.]{0,80}\.\s*/gi, ""],
    [/this\s+guide\s+covers[^.]{0,80}\.\s*/gi, ""],
    [/this\s+guide\s+walks\s+you\s+through[^.]{0,80}\.\s*/gi, ""],
    [/this\s+piece\s+covers[^.]{0,80}\.\s*/gi, ""],
    [/this\s+post\s+covers[^.]{0,80}\.\s*/gi, ""],
  ];
  for (const [re, rep] of pairs) t = t.replace(re, rep);
  return t;
}
function richPara(text: string, style: React.CSSProperties, key: number | string) {
  if (HTML_TAG_RE.test(text)) {
    return <div key={key} className="v2-rich" style={style} dangerouslySetInnerHTML={{ __html: text }} />;
  }
  return <p key={key} style={style}>{text}</p>;
}

// Generic inline-editable element — heading, bullet, FAQ question/answer, etc.
function EditableText({ text, as: Tag = "span", style, className, onSave }: {
  text: string;
  as?: "span" | "div" | "p" | "h2" | "h3";
  style?: React.CSSProperties;
  className?: string;
  onSave?: (newText: string) => void;
}) {
  const elRef = useRef<HTMLElement>(null);
  const isFocusedRef = useRef(false);

  useLayoutEffect(() => {
    if (!elRef.current || isFocusedRef.current) return;
    if (elRef.current.innerText !== text) elRef.current.innerText = text;
  }, [text]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={elRef as React.RefObject<any>} contentEditable suppressContentEditableWarning className={className}
      style={{ outline: "none", cursor: "text", borderRadius: 3, ...style }}
      onFocus={() => { isFocusedRef.current = true; }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        isFocusedRef.current = false;
        const newText = (e.currentTarget as HTMLElement).innerText.trim();
        if (newText !== text) onSave?.(newText);
      }}
    />
  );
}

// Inline-editable paragraph — uses contentEditable so text stays in natural flow (no box/scroll)
function EditablePara({ text, style, paraKey, sectionOrder, paraId, onEditParagraph }: {
  text: string;
  style: React.CSSProperties;
  paraKey: number | string;
  sectionOrder: number;
  paraId: number;
  onEditParagraph?: (sectionOrder: number, paraId: number, text: string) => void;
}) {
  const isHTML = HTML_TAG_RE.test(text);
  const elRef = useRef<HTMLElement>(null);
  // Tracks whether the element currently has focus so useLayoutEffect never
  // overwrites the user's in-progress edits during a parent re-render.
  const isFocusedRef = useRef(false);

  // Sync prop → DOM only when the element is NOT being edited.
  useLayoutEffect(() => {
    if (!elRef.current || isFocusedRef.current) return;
    if (isHTML) { if (elRef.current.innerHTML !== text) elRef.current.innerHTML = text; }
    else { if (elRef.current.innerText !== text) elRef.current.innerText = text; }
  }, [text, isHTML]);

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    isFocusedRef.current = true;
    e.currentTarget.style.background = "rgba(22,61,38,.04)";
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    isFocusedRef.current = false;
    const newText = isHTML ? e.currentTarget.innerHTML : e.currentTarget.innerText;
    if (newText !== text) onEditParagraph?.(sectionOrder, paraId, newText);
    e.currentTarget.style.background = "";
  };

  const shared = {
    contentEditable: true as const,
    suppressContentEditableWarning: true,
    style: { ...style, cursor: "text", outline: "none", borderRadius: 4 } as React.CSSProperties,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = "rgba(22,61,38,.04)"; },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.background = ""; },
  };

  if (isHTML) return <div key={paraKey} {...shared} ref={elRef as React.RefObject<HTMLDivElement>} className="v2-rich" />;
  return <p key={paraKey} {...shared} ref={elRef as React.RefObject<HTMLParagraphElement>} />;
}

function NewsletterArticle({ article, outline, onScore: _onScore, onPublish: _onPublish, highlightedSectionId, brandVoiceMatches, onEditParagraph, onEditHeading, onEditBullet }: {
  article: GeneratedArticle;
  outline: V2OutlineSection[];
  onScore: () => void;
  onPublish: () => void;
  highlightedSectionId?: string | null;
  brandVoiceMatches?: string[];
  onEditParagraph?: (sectionOrder: number, paraId: number, text: string) => void;
  onEditHeading?: (sectionOrder: number, heading: string) => void;
  onEditBullet?: (sectionOrder: number, bulletIdx: number, text: string) => void;
}) {
  const { sections } = article;
  const [subEmail, setSubEmail] = useState("");
  const [subState, setSubState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [faqOpenIdx, setFaqOpenIdx] = useState<number | null>(0);
  const articleBodyRef = useRef<HTMLDivElement>(null);

  // DOM-based brand voice violation highlighting — same approach as v1
  useEffect(() => {
    const root = articleBodyRef.current;
    if (!root) return;
    // Strip any existing marks first
    root.querySelectorAll("mark[data-bv-violation]").forEach(mark => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
      parent.normalize();
    });
    const matches = brandVoiceMatches?.filter(Boolean) ?? [];
    if (!matches.length) return;
    // Walk all text nodes and wrap first occurrence of each match
    function highlightNode(el: HTMLElement) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let n = walker.nextNode();
      while (n) { textNodes.push(n as Text); n = walker.nextNode(); }
      for (const textNode of textNodes) {
        const text = textNode.textContent ?? "";
        for (const match of matches) {
          const idx = text.indexOf(match);
          if (idx === -1) continue;
          const parent = textNode.parentNode;
          if (!parent) break;
          const mark = document.createElement("mark");
          mark.setAttribute("data-bv-violation", "true");
          mark.style.cssText = "background:#fef3c7;color:#92400e;border-radius:2px;padding:0 2px;outline:1px solid #f59e0b;";
          mark.textContent = match;
          parent.insertBefore(document.createTextNode(text.slice(0, idx)), textNode);
          parent.insertBefore(mark, textNode);
          parent.insertBefore(document.createTextNode(text.slice(idx + match.length)), textNode);
          parent.removeChild(textNode);
          break;
        }
      }
    }
    highlightNode(root);
  }, [brandVoiceMatches, article]);

  async function handleSubscribe() {
    const email = subEmail.trim();
    if (!email || subState === "loading" || subState === "success") return;
    setSubState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "newsletter-footer" }),
      });
      setSubState(res.ok ? "success" : "error");
    } catch {
      setSubState("error");
    }
  }

const hlStyle = (heading: string): React.CSSProperties =>
    highlightedSectionId === sectionSlug(heading)
      ? { outline: "2.5px solid #F5A623", borderRadius: 8, transition: "outline .1s" }
      : {};

  const isFaq = (s: GeneratedSection) =>
    /^faq$/i.test(s.type) || /frequently.asked/i.test(s.type) || /frequently asked/i.test(s.heading);
  const isSpecial = (s: GeneratedSection) =>
    /^(introduction|stats|conclusion)$/i.test(s.type) || isFaq(s);

  const intro = sections.find(s => /^introduction$/i.test(s.type));
  const statsSection = sections.find(s => /^stats$/i.test(s.type));
  const faqSection = sections.find(isFaq);
  const conclusion = sections.find(s => /^conclusion$/i.test(s.type));
  const body = sections.filter(s => !isSpecial(s));

  const divider = <div style={{ height: 1, background: "rgba(22,61,38,.1)", margin: "40px 0" }} />;

  return (
    <div ref={articleBodyRef} style={{ maxWidth: 720, margin: 0 }}>

      {/* Newsletter masthead */}
      <div className="v2-masthead" style={{ background: C.dark, padding: "28px 44px", borderRadius: "12px 12px 0 0" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: C.salmon, marginBottom: 10 }}>AI To Market · Blog</div>
        <h1 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: C.white, letterSpacing: "-.3px" }}>
          {article.title}
        </h1>
        <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,.45)" }}>
          {sections.length} sections · generated article
        </div>
      </div>

      {/* Hero image */}
      <div style={{ background: `linear-gradient(140deg, #163D26 0%, #185F00 100%)`, height: 240, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <svg viewBox="0 0 400 240" width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: .06 }} preserveAspectRatio="xMidYMid slice">
          <defs><pattern id="nlgrid" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="white" strokeWidth="1"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#nlgrid)"/>
        </svg>
        <div style={{ position: "relative", textAlign: "center" }}>
          <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="1.5" strokeLinecap="round">
            <rect x="4" y="4" width="40" height="40" rx="4"/><circle cx="16" cy="18" r="4"/><path d="M44 32l-10-10-14 14"/>
          </svg>
          <div style={{ marginTop: 10, fontSize: 10, fontWeight: 600, letterSpacing: ".12em", color: "rgba(255,255,255,.28)" }}>HERO IMAGE</div>
        </div>
      </div>

      {/* Article body */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", padding: "44px 52px" }}>

        {/* Introduction */}
        {intro && (() => {
          const idx = sections.indexOf(intro);
          return (
            <div id={sectionSlug(intro.heading)} style={{ marginBottom: 8, scrollMarginTop: 32, ...hlStyle(intro.heading) }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".16em", color: C.salmon, marginBottom: 14 }}>{intro.eyebrow || "LEAD ITEM"}</div>
              <h2 style={{ margin: "0 0 18px", fontSize: 21, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-.3px", color: C.dark }}>{intro.heading}</h2>
              {intro.content.paragraphs.map((p, i) =>
                <EditablePara key={p.id} text={p.text} style={{ margin: i < intro.content.paragraphs.length - 1 ? "0 0 15px" : 0, fontSize: 15, fontWeight: 400, lineHeight: 1.7, color: "#222" }} paraKey={p.id} sectionOrder={intro.order} paraId={p.id} onEditParagraph={onEditParagraph} />
              )}
            </div>
          );
        })()}

        {/* Body sections */}
        {body.map((s, bi) => {
          const idx = sections.indexOf(s);
          return (
            <div key={s.order} id={sectionSlug(s.heading)} style={{ scrollMarginTop: 32, ...hlStyle(s.heading) }}>
              {divider}
              <ImgPlaceholder height={170} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.mid, marginBottom: 12 }}>
                {s.eyebrow || s.type.replace(/_/g, " ").toUpperCase()}
              </div>
              <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, lineHeight: 1.3, letterSpacing: "-.2px", color: C.dark }}>{s.heading}</h3>
              {s.content.paragraphs.map((p, i) =>
                <EditablePara key={p.id} text={p.text} style={{ margin: i < s.content.paragraphs.length - 1 ? "0 0 14px" : 0, fontSize: 15, fontWeight: 400, lineHeight: 1.7, color: "#222" }} paraKey={p.id} sectionOrder={s.order} paraId={p.id} onEditParagraph={onEditParagraph} />
              )}
              {s.content.bullets.length > 0 && (
                <ul style={{ margin: "14px 0 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 7 }}>
                  {s.content.bullets.map((b, i) => (
                    <li key={i} style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.65, color: "#222" }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {/* Stats / BY THE NUMBERS */}
        {statsSection && (() => {
          const ps = statsSection.content.paragraphs;
          return (
            <div id={sectionSlug(statsSection.heading)} style={{ scrollMarginTop: 32, ...hlStyle(statsSection.heading) }}>
              {divider}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".16em", color: C.mid, marginBottom: 14 }}>BY THE NUMBERS</div>
              <h3 style={{ margin: "0 0 22px", fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: C.dark }}>{statsSection.heading}</h3>
              {ps.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
                  {ps.slice(0, 3).map((p, i) => {
                    const m = p.text.match(/(\d[\d,.%x+\-]*\s*(?:billion|million|thousand|percent|%|x)?)/i);
                    const stat = m ? m[1].trim() : "—";
                    const caption = p.text.replace(stat, "").trim().slice(0, 72);
                    return (
                      <div key={i} style={{ padding: "20px 16px", background: C.dark, borderRadius: 10, textAlign: "center" }}>
                        <div style={{ fontSize: 30, fontWeight: 700, color: C.salmon, lineHeight: 1, letterSpacing: -1 }}>{stat}</div>
                        <div style={{ marginTop: 10, fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,.6)", lineHeight: 1.45 }}>{caption || p.text.slice(0, 60)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {ps.slice(3).map((p, i) =>
                richPara(p.text, { margin: "0 0 13px", fontSize: 14, fontWeight: 400, lineHeight: 1.65, color: "#222" }, i)
              )}
            </div>
          );
        })()}

        {/* FAQ — accordion */}
        {faqSection && (() => {
          // Parse "Q: ...\nA: ..." format produced by the LLM
          const faqItems = faqSection.content.paragraphs.map((p, i) => {
            // Strip outer HTML wrapper tags the LLM sometimes emits
            const raw = p.text.replace(/^<p>/i, "").replace(/<\/p>$/i, "").trim();
            // Match "Q: <question>\n\nA: <answer>" or "Q: <question> A: <answer>" (same line)
            const m = raw.match(/^Q:\s*([\s\S]+?)\s*(?:\n+|\s{2,})A:\s*([\s\S]+)$/i)
              ?? raw.match(/^Q:\s*(.+?)\s+A:\s*([\s\S]+)$/i);
            if (m) return { id: p.id, question: m[1].trim(), answer: m[2].trim() };
            // Fallback: split on any "A:" boundary
            const splitIdx = raw.search(/(?:\n|^)A:\s/im);
            if (splitIdx !== -1) {
              const q = raw.slice(0, splitIdx).replace(/^Q:\s*/i, "").trim();
              const a = raw.slice(splitIdx).replace(/^A:\s*/i, "").trim();
              return { id: p.id, question: q, answer: a };
            }
            // Last resort: whole paragraph is the answer
            return { id: p.id, question: `Question ${i + 1}`, answer: raw };
          });
          return (
            <div id={sectionSlug(faqSection.heading)} style={{ scrollMarginTop: 32, ...hlStyle(faqSection.heading) }}>
              {divider}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".16em", color: C.mid, marginBottom: 18 }}>FREQUENTLY ASKED QUESTIONS</div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                {faqItems.map((item, i) => {
                  const open = faqOpenIdx === i;
                  return (
                    <div key={item.id} style={{ borderBottom: i < faqItems.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      {/* Row: editable question + separate toggle button */}
                      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: open ? C.faint : "transparent", transition: "background .15s" }}>
                        <EditableText
                          text={item.question}
                          as="span"
                          style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45, color: C.dark, flex: 1 }}
                          onSave={newQ => onEditParagraph?.(faqSection.order, item.id, `Q: ${newQ}\n\nA: ${item.answer}`)}
                        />
                        <button
                          onClick={() => setFaqOpenIdx(open ? null : i)}
                          style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", border: `1.5px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, lineHeight: 1, color: C.mid, background: "transparent", cursor: "pointer", transition: "transform .18s", transform: open ? "rotate(45deg)" : "none", userSelect: "none" }}
                        >+</button>
                      </div>
                      {open && item.answer && (
                        <EditableText
                          text={item.answer}
                          as="div"
                          style={{ padding: "2px 20px 18px", fontSize: 14, fontWeight: 400, lineHeight: 1.65, color: C.muted }}
                          onSave={newA => onEditParagraph?.(faqSection.order, item.id, `Q: ${item.question}\n\nA: ${newA}`)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Conclusion / Key takeaways */}
        {conclusion && (() => {
          // Gather bullets — prefer the bullets array, then extract <li> from HTML paragraph
          let takeaways = conclusion.content.bullets.filter(b => b.trim());
          if (takeaways.length === 0 && conclusion.content.paragraphs.length > 0) {
            // Try each paragraph; stop when we get bullets
            for (const para of conclusion.content.paragraphs) {
              const pText = para.text;
              if (/<li/i.test(pText)) {
                takeaways = (pText.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [])
                  .map(li => li.replace(/<\/?li[^>]*>/gi, "").replace(/<[^>]+>/g, "").trim())
                  .filter(Boolean);
                if (takeaways.length > 0) break;
              } else {
                // Split on sentence boundaries so each sentence becomes its own bullet
                const sentences = pText
                  .replace(/<[^>]+>/g, "")
                  .trim()
                  .split(/(?<=[.!?])\s+/)
                  .map(s => s.trim())
                  .filter(Boolean);
                takeaways.push(...sentences);
              }
            }
          }
          const bulletStyle: React.CSSProperties = { fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: "rgba(255,255,255,.85)" };
          return (
            <div id={sectionSlug(conclusion.heading)} style={{ scrollMarginTop: 32, ...hlStyle(conclusion.heading) }}>
              {divider}
              <div style={{ background: C.dark, borderRadius: 12, padding: "32px 36px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".16em", color: C.salmon, marginBottom: 14 }}>KEY TAKEAWAYS</div>
                <EditableText
                  text={conclusion.heading}
                  as="h3"
                  style={{ margin: "0 0 22px", fontSize: 18, fontWeight: 700, color: C.white, lineHeight: 1.3 }}
                  onSave={newH => onEditHeading?.(conclusion.order, newH)}
                />
                {takeaways.map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: i < takeaways.length - 1 ? 13 : 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.salmon, marginTop: 5, flexShrink: 0 }} />
                    <EditableText
                      text={b}
                      as="div"
                      style={bulletStyle}
                      onSave={newB => onEditBullet?.(conclusion.order, i, newB)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      </div>

      {/* Footer */}
      <div style={{ background: C.dark, padding: "28px 44px", borderRadius: "0 0 12px 12px" }}>
        {/* Top row: logo + socials */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>AI To Market</div>
          <div style={{ display: "flex", gap: 10 }}>
            {/* LinkedIn */}
            <a href="https://www.linkedin.com/company/ai-to-market" target="_blank" rel="noreferrer"
              style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", textDecoration: "none" }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill={C.white}>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            {/* X / Twitter */}
            <a href="https://x.com/aitomarket" target="_blank" rel="noreferrer"
              style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", textDecoration: "none" }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill={C.white}>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L2.25 2.25h6.918l4.253 5.623 5.823-5.623zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Email subscribe */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.white, marginBottom: 4 }}>Get our blogs in your DMs</div>
          {subState === "success" ? (
            <div style={{ padding: "10px 14px", borderRadius: 7, background: "rgba(24,95,0,.25)", border: "1px solid rgba(24,95,0,.4)", fontSize: 12, fontWeight: 600, color: "#7FD4A0" }}>
              You're in! We'll send new articles your way.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                type="email"
                value={subEmail}
                onChange={e => { setSubEmail(e.target.value); if (subState === "error") setSubState("idle"); }}
                onKeyDown={e => { if (e.key === "Enter") void handleSubscribe(); }}
                placeholder="your@email.com"
                disabled={subState === "loading"}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 7, border: `1px solid ${subState === "error" ? "rgba(249,57,67,.5)" : "rgba(255,255,255,.2)"}`, background: "rgba(255,255,255,.08)", color: C.white, fontSize: 12, outline: "none", opacity: subState === "loading" ? 0.6 : 1 }}
              />
              <button
                onClick={() => void handleSubscribe()}
                disabled={subState === "loading" || !subEmail.trim()}
                style={{ padding: "9px 16px", borderRadius: 7, background: C.salmon, color: C.dark, fontSize: 12, fontWeight: 700, border: "none", cursor: subState === "loading" || !subEmail.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: subState === "loading" || !subEmail.trim() ? 0.6 : 1 }}
              >
                {subState === "loading" ? "…" : "Subscribe"}
              </button>
            </div>
          )}
          {subState === "error" && (
            <div style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>Something went wrong — please try again.</div>
          )}
          <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,.4)", marginTop: subState === "success" ? 10 : 0 }}>
            Have a suggestion? Tell us more at <span style={{ color: C.salmon }}>socials@aitomarketgroup.com</span>
          </div>
        </div>
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

function EditorScreen({ onScore, onPublish, draftCards, activeCardId, onActivateCard, onBackToCards, onResumeChat, onTrashCard, presenceData }: { onScore: () => void; onPublish: () => void; draftCards?: DraftCard[]; activeCardId: string | null; onActivateCard: (id: string) => void; onBackToCards: () => void; onResumeChat?: () => void; onTrashCard?: (id: string) => void; presenceData?: PresenceUser[] }) {
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
  const [sentToSanityIds, setSentToSanityIds] = useState<Set<string>>(new Set());
  const [withArticleIds, setWithArticleIds] = useState<Set<string>>(new Set());
  const [savePulse, setSavePulse] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [bvExpanded, setBvExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [hoveredSection, setHoveredSection] = useState<number | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [regeneratingSections, setRegeneratingSections] = useState<Set<number>>(new Set());
  const prevCardIdRef = useRef<string | null>(null);
  const preloadedPlanRef = useRef<{ outline: V2OutlineSection[]; title: string; brief: BriefFields } | null>(null);
  const metadataAutoFetchRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Article generation state ────────────────────────────────────────────────
  const [articleData, setArticleData] = useState<GeneratedArticle | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [geoScore, setGeoScore] = useState<{ score: number; checks: { label: string; pass: boolean; evidence: string }[]; wordCount: number } | null>(null);
  const [qualityFlags, setQualityFlags] = useState<{ section?: string; type: string; message: string }[]>([]);
  const [brandVoiceStatus, setBrandVoiceStatus] = useState<{ status: string; residuals?: { paragraphIndex: number; violations: { type: string; match: string }[] }[] } | null>(null);
  // ── SEO panel state ────────────────────────────────────────────────────────
  const [seoPageTitle, setSeoPageTitle] = useState("");  // editable article title for SEO "Title" field
  const [seoTitle, setSeoTitle] = useState("");          // LLM-generated SEO title ≤60 chars
  const [seoSlug, setSeoSlug] = useState("");            // server-generated slug
  const [seoMetaDesc, setSeoMetaDesc] = useState("");
  const [seoTags, setSeoTags] = useState<string[]>([]);
  const [articleFinalised, setArticleFinalised] = useState(false);
  const [seoMetadataLoading, setSeoMetadataLoading] = useState(false);
  const [seoExcerpt, setSeoExcerpt] = useState("");
  const [seoFocusKeyword, setSeoFocusKeyword] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  // ── Publish state ──────────────────────────────────────────────────────────
  const [draftState, setDraftState] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftSentAt, setDraftSentAt] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);

  function scrollToSection(heading: string) {
    const id = sectionSlug(heading);
    setHighlightedSectionId(id);
    setTimeout(() => setHighlightedSectionId(null), 2200);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function sendToDraftSanity() {
    if (!activeCardId || draftState === "loading") return;
    setDraftState("loading");
    setDraftError(null);
    try {
      const res = await fetch(`/api/builder-sessions/${activeCardId}/publish-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seoPageTitle, seoTitle, seoSlug, seoMetaDesc, seoTags, seoExcerpt, seoFocusKeyword }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setDraftState("error"); setDraftError(data.error ?? "Failed to save draft"); return; }
      setDraftState("success");
      setDraftSentAt(new Date().toISOString());
      if (activeCardId) setSentToSanityIds(prev => new Set([...prev, activeCardId]));
    } catch {
      setDraftState("error");
      setDraftError("Network error — please try again");
    }
  }

  async function publishLive() {
    if (!activeCardId || liveState === "loading") return;
    // Sanity draft must exist — never auto-send; user must click "Save as draft in Sanity" first
    if (draftState !== "success") {
      setLiveState("error");
      setLiveError("Save as draft in Sanity first before publishing live.");
      return;
    }
    setLiveState("loading");
    setLiveError(null);
    try {
      const res = await fetch(`/api/builder-sessions/${activeCardId}/publish-live`, { method: "POST" });
      const data = await res.json() as { error?: string; link?: string };
      if (!res.ok) { setLiveState("error"); setLiveError(data.error ?? "Failed to publish"); return; }
      setLiveState("success");
      setLiveUrl(data.link ?? null);
    } catch {
      setLiveState("error");
      setLiveError("Network error — please try again");
    }
  }

  // ── Load saved plans from Supabase on mount (org-wide) ────────────────────
  useEffect(() => {
    fetch("/api/saved-plans")
      .then(r => r.json())
      .then((plans: SavedPlan[]) => { if (Array.isArray(plans)) setSavedPlans(plans); })
      .catch(() => {});
    // Load builder sessions to find which cards have been sent to Sanity or have a saved article
    fetch("/api/builder-sessions")
      .then(r => r.json())
      .then((sessions: { opportunityId?: string; sentToWordPressAt?: string | null; currentStep?: number }[]) => {
        if (!Array.isArray(sessions)) return;
        const sent = new Set(
          sessions
            .filter(s => s.opportunityId && s.sentToWordPressAt)
            .map(s => s.opportunityId!)
        );
        setSentToSanityIds(sent);
        // Cards with a generated article (step 2+) that haven't been sent to Sanity yet
        const withArticle = new Set(
          sessions
            .filter(s => s.opportunityId && (s.currentStep ?? 1) >= 2 && !s.sentToWordPressAt)
            .map(s => s.opportunityId!)
        );
        setWithArticleIds(withArticle);
      })
      .catch(() => {});
  }, []);

  // ── Autosave: persist editor state per card so refresh restores correctly ──
  // Runs on every state change — no early-exit guard so even small changes are saved.
  useEffect(() => {
    if (!activeCardId) return;
    writeCardCache(activeCardId, {
      editorStep: articleData ? "article" : editorStep,
      outline,
      articleTitle,
      articleData: articleData ?? null,
      geoScore: geoScore ?? null,
      qualityFlags,
      brandVoiceStatus: brandVoiceStatus ?? null,
      seoPageTitle,
      seoTitle,
      seoSlug,
      seoMetaDesc,
      seoTags,
      articleFinalised,
      seoExcerpt,
      seoFocusKeyword,
      draftSentAt: draftSentAt ?? undefined,
      savedAt: new Date().toISOString(),
    });
  }, [activeCardId, editorStep, outline, articleTitle, articleData, geoScore, qualityFlags, brandVoiceStatus, seoPageTitle, seoTitle, seoSlug, seoMetaDesc, seoTags, articleFinalised, seoExcerpt, seoFocusKeyword]);

  // ── Debounced Supabase auto-save: fires 3 s after articleData last changed ─
  useEffect(() => {
    if (!activeCardId || !articleData) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaving(true);
    setIsSaved(false);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/builder-sessions/${activeCardId}/save-article`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article: articleData }),
        });
        setIsSaved(true);
      } catch { /* non-fatal */ } finally {
        setAutoSaving(false);
      }
    }, 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [activeCardId, articleData]);

  // ── Generate outline when a card is activated ──────────────────────────────
  useEffect(() => {
    // When the user goes back to the card grid, reset the ref so re-activating
    // the same card always triggers a fresh cache restore instead of reusing
    // stale component state (e.g. editorStep:"plan" left from "Back to plan" click).
    if (!activeCardId) {
      // Save final state to cache BEFORE clearing — the reactive autosave fires
      // with activeCardId=null and returns early, so this is the last chance to
      // capture state that changed in the same render batch (e.g. qualityFlags
      // cleared by autoFixAll just before the user hit Back).
      const prevId = prevCardIdRef.current;
      if (prevId) {
        writeCardCache(prevId, {
          editorStep: articleData ? "article" : editorStep,
          outline,
          articleTitle,
          articleData: articleData ?? null,
          geoScore: geoScore ?? null,
          qualityFlags,
          brandVoiceStatus: brandVoiceStatus ?? null,
          seoPageTitle,
          seoTitle,
          seoSlug,
          seoMetaDesc,
          seoTags,
          articleFinalised,
          seoExcerpt,
          seoFocusKeyword,
          savedAt: new Date().toISOString(),
        });
      }
      prevCardIdRef.current = null;
      metadataAutoFetchRef.current = false;
      // Clear article state so the next card activation starts from a clean slate
      setEditorStep("plan");
      setOutline([]);
      setArticleTitle("");
      setArticleData(null);
      setGeoScore(null);
      setQualityFlags([]);
      setBrandVoiceStatus(null);
      setArticleLoading(false);
      setArticleError(null);
      setSeoPageTitle("");
      setSeoTitle("");
      setSeoSlug("");
      setSeoMetaDesc("");
      setSeoTags([]);
      setArticleFinalised(false);
      setSeoExcerpt("");
      setSeoFocusKeyword("");
      return;
    }
    if (prevCardIdRef.current === activeCardId) return;
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

    // Restore from autosave cache if available
    const cached = readCardCache(activeCardId);
    if (cached && (cached.outline.length > 0 || cached.articleData)) {
      setEditorStep(cached.editorStep);
      setOutline(cached.outline ?? []);
      setArticleTitle(cached.articleTitle ?? "");
      setEditingTitles({});
      setExpandedSection(null);
      setOutlineError(null);
      setOutlineLoading(false);
      if (cached.editorStep === "article" && cached.articleData) {
        setArticleData(cached.articleData);
        setGeoScore(cached.geoScore ?? null);
        setQualityFlags(cached.qualityFlags ?? []);
        setBrandVoiceStatus(cached.brandVoiceStatus ?? null);
        setSeoPageTitle(cached.seoPageTitle ?? "");
        setSeoTitle(cached.seoTitle ?? "");
        setSeoSlug(cached.seoSlug ?? "");
        setSeoMetaDesc(cached.seoMetaDesc ?? "");
        setSeoTags(cached.seoTags ?? []);
        setArticleFinalised(cached.articleFinalised ?? false);
        setSeoExcerpt(cached.seoExcerpt ?? "");
        setSeoFocusKeyword(cached.seoFocusKeyword ?? "");
        if (cached.draftSentAt) { setDraftSentAt(cached.draftSentAt); setDraftState("success"); }
        setArticleLoading(false);
        setArticleError(null);
      }
      return;
    }

    // Sent-to-Sanity OR article-saved cards: fetch from server directly —
    // skip outline generation entirely, no token cost, land on article step.
    if (sentToSanityIds.has(activeCardId) || withArticleIds.has(activeCardId)) {
      setEditorStep("article");
      setArticleLoading(true);
      setArticleError(null);
      fetch(`/api/builder-sessions/${activeCardId}/restore-article`, { method: "POST" })
        .then(async r => {
          const data = await r.json() as {
            article?: GeneratedArticle;
            geoScore?: { score: number; checks: { label: string; pass: boolean; evidence: string }[]; wordCount: number };
            qualityFlags?: { section?: string; type: string; message: string }[];
            error?: string;
          };
          if (r.ok && data.article) {
            setArticleData(data.article);
            setGeoScore(data.geoScore ?? null);
            setQualityFlags(data.qualityFlags ?? []);
            setSeoTitle(data.article.title?.slice(0, 60) ?? "");
            setDraftSentAt(prev => prev ?? new Date().toISOString());
            setDraftState("success");
          } else {
            setArticleError(data.error ?? "Could not load saved article");
          }
        })
        .catch(() => setArticleError("Network error — could not load article"))
        .finally(() => setArticleLoading(false));
      return;
    }

    const card = draftCards?.find(c => c.opportunityId === activeCardId);

    // If another team member saved a plan for this card, restore it (org-wide workspace)
    const sharedPlan = savedPlans?.find(p => p.opportunityId === activeCardId);
    if (sharedPlan) {
      setEditorStep("plan");
      setOutline(sharedPlan.outline);
      setArticleTitle(sharedPlan.articleTitle);
      setEditingTitles({});
      setExpandedSection(null);
      setOutlineError(null);
      setOutlineLoading(false);
      return;
    }

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
      .then(async r => {
        const body = await r.json() as { article_title?: string; sections?: V2OutlineSection[]; error?: string };
        if (!r.ok) return Promise.reject(body.error ?? `Server error (${r.status})`);
        return body;
      })
      .then(data => {
        setArticleTitle(data.article_title ?? card?.brief?.prompt ?? "Article");
        setOutline(data.sections ?? []);
      })
      .catch((e: unknown) => setOutlineError(e instanceof Error ? e.message : String(e)))
      .finally(() => setOutlineLoading(false));
  }, [activeCardId, draftCards, savedPlans, sentToSanityIds, withArticleIds]);

  // ── Save current plan (org-wide via Supabase) ─────────────────────────────
  async function handleSavePlan() {
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
    setSavedPlans(prev => [plan, ...prev.filter(p => p.opportunityId !== activeCardId)]);
    setSavePulse(true);
    setTimeout(() => setSavePulse(false), 1400);
    await fetch("/api/saved-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    }).catch(() => {});
  }

  // ── Resume a saved plan ────────────────────────────────────────────────────
  function handleResumeSavedPlan(plan: SavedPlan) {
    preloadedPlanRef.current = { outline: plan.outline, title: plan.articleTitle, brief: plan.brief };
    prevCardIdRef.current = null; // allow the useEffect to fire for this id
    onActivateCard(plan.opportunityId);
  }

  // ── Delete a saved plan ────────────────────────────────────────────────────
  async function handleDeleteSavedPlan(opportunityId: string) {
    setSavedPlans(prev => prev.filter(p => p.opportunityId !== opportunityId));
    await fetch(`/api/saved-plans/${opportunityId}`, { method: "DELETE" }).catch(() => {});
  }

  // ── Helper: get the (possibly edited) title for a section ─────────────────
  function getSectionTitle(idx: number, original: string) {
    return editingTitles[idx] !== undefined ? editingTitles[idx] : original;
  }

  // ── Section manipulation ───────────────────────────────────────────────────
  function handleDeleteSection(idx: number) {
    setOutline(prev => prev.filter((_, i) => i !== idx));
    setEditingTitles(prev => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    });
    if (expandedSection === idx) setExpandedSection(null);
    else if (expandedSection !== null && expandedSection > idx) setExpandedSection(expandedSection - 1);
  }

  function handleDuplicateSection(idx: number) {
    const section = outline[idx];
    const copy = { ...section, title: getSectionTitle(idx, section.title) };
    setOutline(prev => { const next = [...prev]; next.splice(idx + 1, 0, copy); return next; });
    setEditingTitles(prev => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki <= idx) next[ki] = v;
        else next[ki + 1] = v;
      });
      return next;
    });
  }

  async function handleRegenerateSection(idx: number) {
    if (!activeCardId) return;
    const section = outline[idx];
    const title = getSectionTitle(idx, section.title);
    setRegeneratingSections(prev => new Set(prev).add(idx));
    try {
      const res = await fetch(`/api/builder-sessions/${activeCardId}/generate-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic_title: title }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json() as { sections: V2OutlineSection[] };
      const match = data.sections?.find(s => s.type === section.type) ?? data.sections?.[0];
      if (match) {
        setOutline(prev => prev.map((s, i) => i === idx ? { ...s, description: match.description, keywords: match.keywords } : s));
      }
    } catch { /* silently keep existing section */ } finally {
      setRegeneratingSections(prev => { const next = new Set(prev); next.delete(idx); return next; });
    }
  }

  function handleDragStart(e: React.DragEvent, idx: number) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) setDragOverIdx(idx);
  }

  function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const from = dragIdx;
    setOutline(prev => { const next = [...prev]; const [m] = next.splice(from, 1); next.splice(dropIdx, 0, m); return next; });
    setEditingTitles(prev => {
      const order = Array.from({ length: outline.length }, (_, i) => i);
      const [moved] = order.splice(from, 1);
      order.splice(dropIdx, 0, moved);
      const next: Record<number, string> = {};
      order.forEach((oldIdx, newIdx) => { if (prev[oldIdx] !== undefined) next[newIdx] = prev[oldIdx]; });
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  }

  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null); }

  // ── Rescore GEO + brand voice from saved article (no article regen) ─────────
  const [rescoring, setRescoring] = useState(false);

  async function rescoreGeo(overrideArticle?: typeof articleData) {
    if (!activeCardId || rescoring) return;
    setRescoring(true);
    try {
      const res = await fetch(`/api/builder-sessions/${activeCardId}/rescore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the live v2 article so the server doesn't fall back to stale Supabase blocks
        body: JSON.stringify({ article: overrideArticle ?? articleData }),
      });
      // ok() returns data directly — no { data: ... } wrapper
      const data = await res.json() as { geoScore?: typeof geoScore; brandVoiceStatus?: typeof brandVoiceStatus; error?: string };
      if (res.ok) {
        if (data.geoScore) setGeoScore(data.geoScore);
        if (data.brandVoiceStatus) setBrandVoiceStatus(data.brandVoiceStatus);
      }
    } catch { /* non-fatal */ }
    finally { setRescoring(false); }
  }

  // ── Auto-fix state ────────────────────────────────────────────────────────
  const [expandedFlagIdx, setExpandedFlagIdx] = useState<number | null>(null);
  const [fixingFlagIdx, setFixingFlagIdx] = useState<number | null>(null);
  const [expandedCheckIdx, setExpandedCheckIdx] = useState<number | null>(null);
  const [fixingCheckIdx, setFixingCheckIdx] = useState<number | null>(null);
  const [fixingAll, setFixingAll] = useState(false);
  const [fixAllProgress, setFixAllProgress] = useState<string | null>(null);

  async function autoFixFlag(f: { section?: string; type: string; message: string }, flagIdx: number) {
    if (!activeCardId || !articleData || fixingFlagIdx !== null) return;
    setFixingFlagIdx(flagIdx);
    const sectionHeading = f.section ?? f.message.match(/^"([^"]+)"/)?.[1] ?? "";
    const minWordsMatch = f.message.match(/minimum (\d+)/);
    const minWords = minWordsMatch ? parseInt(minWordsMatch[1]) : 150;
    const section = articleData.sections.find(s => s.heading === sectionHeading);
    if (!section) { setFixingFlagIdx(null); return; }
    try {
      const res = await fetch(`/api/builder-sessions/${activeCardId}/fix-section-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixType: "thin_section",
          sectionHeading,
          sectionType: section.type,
          paragraphs: section.content.paragraphs,
          minWords,
          articleTitle: articleData.title,
          sections: articleData.sections,
        }),
      });
      const data = await res.json() as { sectionHeading?: string; paragraphs?: { id: number; text: string }[]; error?: string };
      if (res.ok && data.paragraphs?.length) {
        setArticleData(prev => {
          if (!prev) return prev;
          const updated = { ...prev, sections: prev.sections.map(s =>
            s.heading === sectionHeading ? { ...s, content: { ...s.content, paragraphs: data.paragraphs! } } : s
          ) };
          // Persist to Supabase immediately
          fetch(`/api/builder-sessions/${activeCardId}/save-article`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ article: updated }),
          }).catch(() => {/* non-fatal */});
          return updated;
        });
        setQualityFlags(prev => prev.filter((_, i) => i !== flagIdx));
        setExpandedFlagIdx(null);
      }
    } catch { /* non-fatal */ }
    finally { setFixingFlagIdx(null); }
  }

  async function autoFixGeoCheck(checkLabel: string, checkIdx: number) {
    if (!activeCardId || !articleData || fixingCheckIdx !== null) return;
    setFixingCheckIdx(checkIdx);

    // AI-tell density: replace known phrases directly — no LLM needed, guaranteed to fix
    if (checkLabel === "AI-tell density") {
      try {
        const fixedSections = articleData.sections.map(s => ({
          ...s,
          content: {
            ...s.content,
            paragraphs: s.content.paragraphs.map(p => ({ ...p, text: fixAiTells(p.text) })),
          },
        }));
        const fixedArticle = { ...articleData, sections: fixedSections };
        setArticleData(fixedArticle);
        setExpandedCheckIdx(null);
        await rescoreGeo(fixedArticle);
      } catch { /* non-fatal */ }
      finally { setFixingCheckIdx(null); }
      return;
    }

    try {
      const res = await fetch(`/api/builder-sessions/${activeCardId}/fix-section-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixType: "geo_check",
          checkLabel,
          articleTitle: articleData.title,
          sections: articleData.sections,
        }),
      });
      const data = await res.json() as {
        sectionHeading?: string;
        paragraphs?: { id: number; text: string }[];
        multifix?: { sectionHeading: string; paragraphId: number; newText: string }[];
        error?: string;
      };
      const headingMatch = (a: string, b: string) =>
        a.trim().toLowerCase() === b.trim().toLowerCase() ||
        a.trim().toLowerCase().includes(b.trim().toLowerCase()) ||
        b.trim().toLowerCase().includes(a.trim().toLowerCase());

      if (res.ok && data.multifix?.length) {
        const updatedSections = articleData.sections.map(s => {
          const fixes = data.multifix!.filter(f => headingMatch(s.heading, f.sectionHeading));
          if (!fixes.length) return s;
          const updatedParas = s.content.paragraphs.map(p => {
            const fix = fixes.find(f => f.paragraphId === p.id);
            return fix ? { ...p, text: fix.newText } : p;
          });
          return { ...s, content: { ...s.content, paragraphs: updatedParas } };
        });
        const updatedArticle = { ...articleData, sections: updatedSections };
        setArticleData(updatedArticle);
        setExpandedCheckIdx(null);
        await rescoreGeo(updatedArticle);
      } else if (res.ok && data.paragraphs?.length && data.sectionHeading) {
        const { sectionHeading, paragraphs } = data as { sectionHeading: string; paragraphs: { id: number; text: string }[] };
        const updatedSections = articleData.sections.map(s =>
          headingMatch(s.heading, sectionHeading) ? { ...s, content: { ...s.content, paragraphs } } : s
        );
        const updatedArticle = { ...articleData, sections: updatedSections };
        setArticleData(updatedArticle);
        setExpandedCheckIdx(null);
        await rescoreGeo(updatedArticle);
      }
    } catch { /* non-fatal */ }
    finally { setFixingCheckIdx(null); }
  }

  // ── Auto-fix ALL quality flags in sequence ────────────────────────────────
  async function autoFixAll() {
    if (!activeCardId || !articleData || fixingAll) return;
    setFixingAll(true);
    // Work against a mutable copy of sections so each fix sees the previous fix's output
    let currentSections = [...articleData.sections];
    let remainingFlags = [...qualityFlags];

    for (let i = 0; i < remainingFlags.length; i++) {
      const f = remainingFlags[i];
      const sectionHeading = f.section ?? f.message.match(/^"([^"]+)"/)?.[1] ?? "";
      const section = currentSections.find(s => s.heading === sectionHeading);
      if (!section) continue;

      const minWordsMatch = f.message.match(/minimum (\d+)/);
      const minWords = minWordsMatch ? parseInt(minWordsMatch[1]) : 150;
      setFixAllProgress(`Fixing "${sectionHeading}" (${i + 1}/${remainingFlags.length})…`);

      try {
        const res = await fetch(`/api/builder-sessions/${activeCardId}/fix-section-v2`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fixType: "thin_section",
            sectionHeading,
            sectionType: section.type,
            paragraphs: section.content.paragraphs,
            minWords,
            articleTitle: articleData.title,
            sections: currentSections,
          }),
        });
        const data = await res.json() as { sectionHeading?: string; paragraphs?: { id: number; text: string }[]; error?: string };
        if (res.ok && data.paragraphs?.length) {
          currentSections = currentSections.map(s =>
            s.heading === sectionHeading ? { ...s, content: { ...s.content, paragraphs: data.paragraphs! } } : s
          );
        }
      } catch { /* skip failed fix, continue */ }
    }

    // Commit all changes at once
    const fixedArticle = articleData ? { ...articleData, sections: currentSections } : null;
    setArticleData(prev => prev ? { ...prev, sections: currentSections } : prev);
    setQualityFlags([]);
    setExpandedFlagIdx(null);
    setFixAllProgress(null);
    setFixingAll(false);
    void rescoreGeo();
    // Persist the fixed article to Supabase so restore-article always returns the latest version
    if (fixedArticle && activeCardId) {
      fetch(`/api/builder-sessions/${activeCardId}/save-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article: fixedArticle }),
      }).catch(() => {/* non-fatal */});
    }
  }

  // ── Generate / refresh SEO metadata via LLM ───────────────────────────────
  async function generateMetadata() {
    if (!activeCardId || !articleData || seoMetadataLoading) return;
    setSeoMetadataLoading(true);
    try {
      const res = await fetch(`/api/builder-sessions/${activeCardId}/generate-metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article: articleData }),
      });
      const data = await res.json() as {
        title?: string; slug?: string; seo_title?: string; seo_description?: string;
        tags?: string[]; excerpt?: string; focus_keyword?: string;
      };
      if (res.ok) {
        setSeoPageTitle(data.title ?? "");
        setSeoTitle(data.seo_title ?? "");
        setSeoSlug(data.slug ?? "");
        setSeoMetaDesc(data.seo_description ?? "");
        setSeoTags(data.tags ?? []);
        setSeoExcerpt(data.excerpt ?? "");
        setSeoFocusKeyword(data.focus_keyword ?? "");
      }
    } catch { /* non-fatal */ }
    finally { setSeoMetadataLoading(false); }
  }

  // ── Auto-generate metadata once when article is finalised and no metadata exists ──
  useEffect(() => {
    if (!articleFinalised || !articleData || !activeCardId) return;
    if (seoTitle || seoMetaDesc) return; // already has metadata, skip
    if (metadataAutoFetchRef.current) return; // already triggered for this card
    metadataAutoFetchRef.current = true;
    void generateMetadata();
  // generateMetadata reads from closure; only re-run when finalised state or card changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleFinalised, articleData, activeCardId]);

  // ── Generate article via validate-plan SSE ─────────────────────────────────
  async function generateArticle() {
    if (!activeCardId) return;
    setArticleData(null);
    setGeoScore(null);
    setQualityFlags([]);
    setBrandVoiceStatus(null);
    setArticleLoading(true);
    setArticleError(null);
    setEditorStep("article");
    try {
      const finalOutline = outline.map((s, i) => ({
        ...s,
        title: getSectionTitle(i, s.title),
      }));
      const res = await fetch(`/api/builder-sessions/${activeCardId}/validate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline: finalOutline }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => res.statusText);
        throw new Error(t || res.statusText);
      }
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json) as {
              article?: GeneratedArticle;
              quality_flags?: { section?: string; type: string; message: string }[];
              geo_score?: { score: number; checks: { label: string; pass: boolean; evidence: string }[]; wordCount: number };
              brand_voice_status?: { status: string; residuals?: { paragraphIndex: number; violations: { type: string; match: string }[] }[] };
            };
            if (parsed.article) {
              setArticleData(parsed.article);
              if (parsed.geo_score) setGeoScore(parsed.geo_score);
              if (parsed.quality_flags) setQualityFlags(parsed.quality_flags);
              if (parsed.brand_voice_status) setBrandVoiceStatus(parsed.brand_voice_status);
              const t = parsed.article.title ?? "";
              setSeoPageTitle(t);   // article title → SEO "Title" field
              setSeoTitle("");      // clear until LLM generates it
              setSeoSlug("");       // clear until LLM generates it
              setSeoMetaDesc("");
              setSeoTags([]);
            }
          } catch { /* partial chunk, keep buffering */ }
        }
      }
    } catch (e) {
      setArticleError(e instanceof Error ? e.message : "Failed to generate article");
      setEditorStep("plan");
    } finally {
      setArticleLoading(false);
    }
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
                <div key={plan.opportunityId} style={{ padding: 24, border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, display: "flex", flexDirection: "column", height: 260, position: "relative" }}>
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
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: C.dark, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

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

        {/* ── Sent to Sanity + All opportunities ── */}
        {(() => {
          const isSent      = (id: string) => sentToSanityIds.has(id) || !!readCardCache(id)?.draftSentAt;
          const hasArticleSaved = (id: string) => withArticleIds.has(id) || (!isSent(id) && !!readCardCache(id)?.articleData);
          const hasPlan     = (id: string) => savedPlans.some(p => p.opportunityId === id);
          const sentCards    = draftCards!.filter(card => isSent(card.opportunityId));
          const articleCards = draftCards!.filter(card => !isSent(card.opportunityId) && hasArticleSaved(card.opportunityId));
          const pendingCards = draftCards!.filter(card => !isSent(card.opportunityId) && !hasArticleSaved(card.opportunityId) && !hasPlan(card.opportunityId));
          return (
            <>
              {sentCards.length > 0 && (
                <div style={{ marginBottom: 48 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.salmon, marginBottom: 8 }}>SENT TO SANITY</div>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.3px" }}>
                        {sentCards.length} article{sentCards.length !== 1 ? "s" : ""} in review
                      </h2>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                    {sentCards.map(card => {
                      const activeUsers = presenceData?.filter(p => p.active_card_id === card.opportunityId) ?? [];
                      return (
                        <DraftCardComponent
                          key={card.opportunityId}
                          card={card}
                          onCreateArticle={() => onActivateCard(card.opportunityId)}
                          onResume={onResumeChat}
                          onRemove={() => onTrashCard?.(card.opportunityId)}
                          activeUsers={activeUsers}
                          hasSavedPlan={savedPlans.some(p => p.opportunityId === card.opportunityId)}
                          sentToSanity
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              {articleCards.length > 0 && (
                <div style={{ marginBottom: 48 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.mid, marginBottom: 8 }}>ARTICLES IN PROGRESS</div>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.3px" }}>
                        {articleCards.length} article{articleCards.length !== 1 ? "s" : ""} saved
                      </h2>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                    {articleCards.map(card => {
                      const activeUsers = presenceData?.filter(p => p.active_card_id === card.opportunityId) ?? [];
                      return (
                        <DraftCardComponent
                          key={card.opportunityId}
                          card={card}
                          onCreateArticle={() => onActivateCard(card.opportunityId)}
                          onResume={onResumeChat}
                          onRemove={() => onTrashCard?.(card.opportunityId)}
                          activeUsers={activeUsers}
                          hasSavedPlan={savedPlans.some(p => p.opportunityId === card.opportunityId)}
                          hasArticle
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", color: C.mid, marginBottom: 8 }}>ALL OPPORTUNITIES</div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.3px" }}>
                    {pendingCards.length} brief{pendingCards.length !== 1 ? "s" : ""} ready to build
                  </h2>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                {pendingCards.map(card => {
                  const activeUsers = presenceData?.filter(p => p.active_card_id === card.opportunityId) ?? [];
                  return (
                    <DraftCardComponent
                      key={card.opportunityId}
                      card={card}
                      onCreateArticle={() => onActivateCard(card.opportunityId)}
                      onResume={onResumeChat}
                      onRemove={() => onTrashCard?.(card.opportunityId)}
                      activeUsers={activeUsers}
                      hasSavedPlan={savedPlans.some(p => p.opportunityId === card.opportunityId)}
                    />
                  );
                })}
              </div>
            </>
          );
        })()}
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

  // ── Presence banner (shared between plan + article steps) ────────────────
  const coEditors = presenceData?.filter(p => p.active_card_id === activeCardId) ?? [];
  const PresenceBanner = coEditors.length > 0 ? (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 20, borderRadius: 8, background: "rgba(24,95,0,.07)", border: "1px solid rgba(24,95,0,.2)" }}>
      <div style={{ display: "flex" }}>
        {coEditors.slice(0, 4).map(u => <UserAvatar key={u.user_id} email={u.user_email} size={24} />)}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.mid }}>
        {coEditors.map(u => u.user_email.split("@")[0]).join(", ")} {coEditors.length === 1 ? "is" : "are"} also working here
      </span>
    </div>
  ) : null;

  // ── PLAN STEP ─────────────────────────────────────────────────────────────
  if (editorStep === "plan") {
    const activeCard = draftCards?.find(c => c.opportunityId === activeCardId);

    return (
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <BackBtn label="All opportunities" onClick={onBackToCards} />
        {PresenceBanner}
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
                const isBeingDragged = dragIdx === idx;
                const isDragTarget = dragOverIdx === idx;
                const isHovered = hoveredSection === idx;
                const isRegenerating = regeneratingSections.has(idx);
                const editedTitle = getSectionTitle(idx, section.title);

                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={e => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    onMouseEnter={() => setHoveredSection(idx)}
                    onMouseLeave={() => setHoveredSection(null)}
                    style={{
                      border: `1px solid ${isDragTarget ? C.mid : isExpanded ? "rgba(22,61,38,.22)" : C.border}`,
                      borderRadius: 10,
                      background: isBeingDragged ? "rgba(22,61,38,.04)" : isExpanded ? C.white : "rgba(255,255,255,.7)",
                      transition: "all .15s",
                      opacity: isBeingDragged ? 0.45 : 1,
                      boxShadow: isDragTarget ? `0 0 0 2px rgba(22,61,38,.15)` : "none",
                    }}
                  >
                    {/* Section header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>

                      {/* Drag handle */}
                      <div
                        title="Drag to reorder"
                        style={{ cursor: "grab", flexShrink: 0, color: isHovered ? "rgba(22,61,38,.38)" : "rgba(22,61,38,.12)", transition: "color .15s", display: "flex", alignItems: "center" }}
                        onClick={e => e.stopPropagation()}
                      >
                        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor">
                          <circle cx="3" cy="4" r="1.5"/><circle cx="7" cy="4" r="1.5"/>
                          <circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>
                          <circle cx="3" cy="12" r="1.5"/><circle cx="7" cy="12" r="1.5"/>
                        </svg>
                      </div>

                      {/* Number badge */}
                      <div
                        onClick={() => setExpandedSection(isExpanded ? null : idx)}
                        style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(22,61,38,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "rgba(22,61,38,.55)", flexShrink: 0, cursor: "pointer" }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </div>

                      {/* Title */}
                      <div
                        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                        onClick={() => !isExpanded && setExpandedSection(idx)}
                      >
                        {isExpanded ? (
                          <input
                            value={editedTitle}
                            onChange={e => setEditingTitles(prev => ({ ...prev, [idx]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            style={{ width: "100%", fontSize: 14, fontWeight: 600, color: C.dark, border: "none", background: "transparent", outline: "none", padding: 0 }}
                          />
                        ) : (
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, lineHeight: 1.4 }}>
                            {editedTitle}
                          </div>
                        )}
                      </div>

                      {/* Type badge */}
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "3px 8px", borderRadius: 5, background: typeStyle.bg, color: typeStyle.color, textTransform: "uppercase", flexShrink: 0 }}>
                        {section.type}
                      </span>

                      {/* Section action buttons — visible on hover */}
                      <div style={{ display: "flex", gap: 3, flexShrink: 0, opacity: isHovered ? 1 : 0, transition: "opacity .15s", pointerEvents: isHovered ? "auto" : "none" }}>
                        {/* Regenerate */}
                        <button
                          title="Regenerate section"
                          onClick={e => { e.stopPropagation(); void handleRegenerateSection(idx); }}
                          onMouseEnter={() => setHoveredBtn(`${idx}-regen`)}
                          onMouseLeave={() => setHoveredBtn(null)}
                          disabled={isRegenerating}
                          style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${hoveredBtn === `${idx}-regen` ? "rgba(22,61,38,.35)" : "rgba(22,61,38,.2)"}`, background: hoveredBtn === `${idx}-regen` ? "rgba(22,61,38,.1)" : "rgba(22,61,38,.06)", color: C.dark, cursor: isRegenerating ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, transition: "all .12s" }}
                        >
                          {isRegenerating ? (
                            <div style={{ width: 12, height: 12, border: "2px solid rgba(22,61,38,.25)", borderTopColor: C.mid, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                          ) : (
                            <span style={{ fontSize: 16, lineHeight: 1, userSelect: "none", display: "block" }}>↻</span>
                          )}
                        </button>
                        {/* Duplicate */}
                        <button
                          title="Duplicate section"
                          onClick={e => { e.stopPropagation(); handleDuplicateSection(idx); }}
                          onMouseEnter={() => setHoveredBtn(`${idx}-dup`)}
                          onMouseLeave={() => setHoveredBtn(null)}
                          style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${hoveredBtn === `${idx}-dup` ? "rgba(22,61,38,.35)" : "rgba(22,61,38,.2)"}`, background: hoveredBtn === `${idx}-dup` ? "rgba(22,61,38,.1)" : "rgba(22,61,38,.06)", color: C.dark, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, transition: "all .12s" }}
                        >
                          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="5" width="8" height="9" rx="1.5"/><path d="M3 11V3a1 1 0 011-1h7"/>
                          </svg>
                        </button>
                        {/* Delete */}
                        <button
                          title="Delete section"
                          onClick={e => { e.stopPropagation(); handleDeleteSection(idx); }}
                          onMouseEnter={() => setHoveredBtn(`${idx}-del`)}
                          onMouseLeave={() => setHoveredBtn(null)}
                          style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${hoveredBtn === `${idx}-del` ? "rgba(249,57,67,.4)" : "rgba(22,61,38,.2)"}`, background: hoveredBtn === `${idx}-del` ? "rgba(249,57,67,.08)" : "rgba(22,61,38,.06)", color: hoveredBtn === `${idx}-del` ? C.red : C.dark, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, transition: "all .12s" }}
                        >
                          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 5h10M6 5V3h4v2M5 5l.7 8h4.6L11 5"/>
                          </svg>
                        </button>
                      </div>

                      {/* Chevron */}
                      <svg
                        viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        onClick={() => setExpandedSection(isExpanded ? null : idx)}
                        style={{ flexShrink: 0, opacity: .38, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .15s", cursor: "pointer" }}
                      >
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </div>

                    {/* Description bullets (expanded) */}
                    {isExpanded && section.description.length > 0 && (
                      <div style={{ padding: "0 18px 18px 54px", borderTop: "1px solid rgba(22,61,38,.07)" }}>
                        <div style={{ paddingTop: 14 }}>
                          {section.description.map((line, li) => (
                            <div key={li} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                              <div style={{ width: 14, height: 1.5, background: C.mid, marginTop: 9, flexShrink: 0 }} />
                              <textarea
                                value={line}
                                onChange={e => {
                                  const val = e.target.value;
                                  setOutline(prev => prev.map((s, i) => i !== idx ? s : ({ ...s, description: s.description.map((d, di) => di === li ? val : d) })));
                                }}
                                rows={Math.max(1, Math.ceil(line.length / 72))}
                                style={{ flex: 1, fontSize: 12, fontWeight: 400, lineHeight: 1.55, color: "rgba(22,61,38,.72)", border: "none", background: "transparent", outline: "none", resize: "none", padding: 0, fontFamily: "inherit", width: "100%" }}
                              />
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
              {/* Resume article from cache (fastest) */}
              {activeCardId && readCardCache(activeCardId)?.articleData && (
                <button
                  onClick={() => {
                    if (!activeCardId) return;
                    const cached = readCardCache(activeCardId);
                    if (!cached?.articleData) return;
                    setArticleData(cached.articleData);
                    setGeoScore(cached.geoScore ?? null);
                    setQualityFlags(cached.qualityFlags ?? []);
                    setBrandVoiceStatus(cached.brandVoiceStatus ?? null);
                    setSeoPageTitle(cached.seoPageTitle ?? "");
                    setSeoTitle(cached.seoTitle ?? "");
                    setSeoSlug(cached.seoSlug ?? "");
                    setSeoMetaDesc(cached.seoMetaDesc ?? "");
                    setSeoTags(cached.seoTags ?? []);
                    setArticleFinalised(cached.articleFinalised ?? false);
                    setSeoExcerpt(cached.seoExcerpt ?? "");
                    setSeoFocusKeyword(cached.seoFocusKeyword ?? "");
                    setEditorStep("article");
                  }}
                  style={{ padding: "13px 24px", borderRadius: 8, background: C.mid, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                >
                  Resume article
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8h8M9 4l4 4-4 4" />
                  </svg>
                </button>
              )}
              {/* Load from server — only shown when card was previously sent to Sanity (server has the article) */}
              {activeCardId && !readCardCache(activeCardId)?.articleData && sentToSanityIds.has(activeCardId) && (
                <button
                  disabled={restoring}
                  onClick={async () => {
                    if (!activeCardId || restoring) return;
                    setRestoring(true);
                    try {
                      const res = await fetch(`/api/builder-sessions/${activeCardId}/restore-article`, { method: "POST" });
                      const data = await res.json() as {
                        article?: GeneratedArticle;
                        geoScore?: { score: number; checks: { label: string; pass: boolean; evidence: string }[]; wordCount: number };
                        qualityFlags?: { section?: string; type: string; message: string }[];
                        error?: string;
                      };
                      if (res.ok && data.article) {
                        setArticleData(data.article);
                        setGeoScore(data.geoScore ?? null);
                        setQualityFlags(data.qualityFlags ?? []);
                        setSeoTitle(data.article.title?.slice(0, 60) ?? "");
                        setEditorStep("article");
                      }
                    } catch { /* non-fatal */ }
                    finally { setRestoring(false); }
                  }}
                  style={{ padding: "13px 24px", borderRadius: 8, background: C.mid, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: restoring ? "default" : "pointer", opacity: restoring ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}
                >
                  {restoring ? <><span style={{ display: "inline-block", animation: "spin .8s linear infinite" }}>↻</span> Loading…</> : "Resume article"}
                  {!restoring && <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8h8M9 4l4 4-4 4" />
                  </svg>}
                </button>
              )}
              <button
                onClick={() => void generateArticle()}
                style={{ padding: "13px 24px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                {activeCardId && readCardCache(activeCardId)?.articleData ? "Regenerate article" : "Generate article"}
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
      {PresenceBanner}
      <StepBar current={2} />

      {/* Loading skeleton */}
      {articleLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
          <div style={{ height: 130, borderRadius: 12, background: "rgba(22,61,38,.09)", animation: "pulse 1.4s ease-in-out infinite" }} />
          <div style={{ height: 240, background: "rgba(22,61,38,.05)", animation: "pulse 1.4s ease-in-out infinite", animationDelay: ".1s" }} />
          <div style={{ height: 180, borderRadius: 10, background: "rgba(22,61,38,.04)", animation: "pulse 1.4s ease-in-out infinite", animationDelay: ".2s" }} />
          <div style={{ height: 160, borderRadius: 10, background: "rgba(22,61,38,.04)", animation: "pulse 1.4s ease-in-out infinite", animationDelay: ".3s" }} />
          <div style={{ marginTop: 8, fontSize: 12, color: "rgba(22,61,38,.5)", fontWeight: 500 }}>Writing your article — usually takes 30–60 seconds…</div>
        </div>
      )}

      {/* Error state */}
      {articleError && !articleLoading && (
        <div style={{ padding: "20px 24px", border: "1px solid rgba(249,57,67,.3)", borderRadius: 10, background: "rgba(249,57,67,.04)", color: C.red, fontSize: 13, maxWidth: 720 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Could not generate article</div>
          <div style={{ fontWeight: 400, opacity: .8 }}>{articleError}</div>
          <button
            onClick={() => void generateArticle()}
            style={{ marginTop: 14, padding: "8px 14px", borderRadius: 7, background: C.red, color: C.white, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
          >Retry</button>
        </div>
      )}

      {/* Newsletter + right sidebar */}
      {articleData && !articleLoading && (() => {
        const score = geoScore?.score ?? 0;
        const scoreColor = score >= 80 ? C.mid : score >= 60 ? "#F5A623" : C.red;
        const checks = geoScore?.checks ?? [];
        const wordCount = geoScore?.wordCount ?? 0;
        const bvStatus = brandVoiceStatus?.status ?? "clean";
        const residualCount = brandVoiceStatus?.residuals?.reduce((n, r) => n + r.violations.length, 0) ?? 0;
        const seoSlugDisplay = seoSlug || seoPageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 272px", gap: 24, alignItems: "start" }}>
            {/* Left: newsletter */}
            <NewsletterArticle
              article={articleData}
              outline={outline}
              onScore={onScore}
              onPublish={onPublish}
              highlightedSectionId={highlightedSectionId}
              brandVoiceMatches={
                brandVoiceStatus?.status === "partial"
                  ? (brandVoiceStatus.residuals?.flatMap(r => r.violations.map(v => v.match)) ?? [])
                  : []
              }
              onEditParagraph={(sectionOrder, paraId, text) => {
                setIsSaved(false);
                setArticleData(prev => !prev ? prev : ({
                  ...prev,
                  sections: prev.sections.map(s => s.order !== sectionOrder ? s : ({
                    ...s,
                    content: {
                      ...s.content,
                      paragraphs: s.content.paragraphs.map(p => p.id !== paraId ? p : { ...p, text }),
                    },
                  })),
                }));
              }}
              onEditHeading={(sectionOrder, heading) => {
                setIsSaved(false);
                setArticleData(prev => !prev ? prev : ({
                  ...prev,
                  sections: prev.sections.map(s => s.order !== sectionOrder ? s : { ...s, heading }),
                }));
              }}
              onEditBullet={(sectionOrder, bulletIdx, text) => {
                setIsSaved(false);
                setArticleData(prev => !prev ? prev : ({
                  ...prev,
                  sections: prev.sections.map(s => {
                    if (s.order !== sectionOrder) return s;
                    // Normalise: if bullets are empty (old data stored in paragraphs), derive them first
                    let bullets = [...s.content.bullets];
                    if (bullets.length === 0 && s.content.paragraphs.length > 0) {
                      for (const para of s.content.paragraphs) {
                        const pText = para.text;
                        if (/<li/i.test(pText)) {
                          bullets.push(...(pText.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [])
                            .map(li => li.replace(/<\/?li[^>]*>/gi, "").replace(/<[^>]+>/g, "").trim())
                            .filter(Boolean));
                        } else {
                          bullets.push(...pText.replace(/<[^>]+>/g, "").trim()
                            .split(/(?<=[.!?])\s+/).map(s2 => s2.trim()).filter(Boolean));
                        }
                      }
                    }
                    bullets[bulletIdx] = text;
                    return { ...s, content: { ...s.content, bullets } };
                  }),
                }));
              }}
            />

            {/* Right: panels */}
            <aside style={{ position: "sticky", top: 72, alignSelf: "start", width: 272, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "calc(100vh - 72px)", paddingBottom: 24 }}>

              {/* ── QUALITY CHECKS ── */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, flexShrink: 0 }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: C.mid }}>QUALITY CHECKS</div>
                </div>
                <div style={{ padding: "14px 16px" }}>

                  {/* Brand voice row */}
                  <div style={{ marginBottom: bvStatus === "partial" && residualCount > 0 ? 10 : 14, paddingBottom: bvStatus === "partial" && residualCount > 0 ? 10 : 14, borderBottom: bvStatus === "partial" && residualCount > 0 ? "none" : `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>Brand Voice</div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                        background: bvStatus === "clean" ? "rgba(24,95,0,.1)" : bvStatus === "partial" ? "rgba(245,166,35,.12)" : "rgba(249,57,67,.08)",
                        color: bvStatus === "clean" ? C.mid : bvStatus === "partial" ? "#A0620A" : C.red,
                      }}>
                        {bvStatus === "clean" ? "Passed" : bvStatus === "partial" ? "Partially corrected" : "Check failed"}
                      </span>
                    </div>
                    {bvStatus === "partial" && residualCount > 0 && (() => {
                      const allViolations = brandVoiceStatus?.residuals?.flatMap(r => r.violations) ?? [];
                      return (
                        <div style={{ marginTop: 8 }}>
                          <button
                            onClick={() => setBvExpanded(e => !e)}
                            style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 500, color: "#A0620A" }}
                          >
                            <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ transition: "transform .18s", transform: bvExpanded ? "rotate(180deg)" : "none" }}><path d="M2 3.5l3 3 3-3"/></svg>
                            {residualCount} violation{residualCount !== 1 ? "s" : ""} — {bvExpanded ? "hide" : "show"} details
                          </button>
                          {bvExpanded && (
                            <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                              {allViolations.map((v, vi) => (
                                <li
                                  key={vi}
                                  onClick={() => {
                                    const marks = document.querySelectorAll<HTMLElement>('mark[data-bv-violation="true"]');
                                    for (const mark of marks) {
                                      if (mark.textContent === v.match) {
                                        mark.scrollIntoView({ behavior: "smooth", block: "center" });
                                        const orig = mark.style.cssText;
                                        mark.style.cssText = "background:#fbbf24;color:#78350f;border-radius:2px;padding:0 2px;outline:2.5px solid #d97706;transition:all .15s;";
                                        setTimeout(() => { mark.style.cssText = orig; }, 1100);
                                        break;
                                      }
                                    }
                                  }}
                                  style={{ fontSize: 10, lineHeight: 1.4, color: "#92400e", display: "flex", gap: 4, alignItems: "baseline", flexWrap: "wrap", cursor: "pointer", borderRadius: 5, padding: "3px 4px", transition: "background .12s" }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(254,243,199,.7)")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                >
                                  <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{v.type.replace(/_/g, " ")}</span>
                                  <span style={{ color: "#A0620A" }}>—</span>
                                  <span style={{ fontFamily: "monospace", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 3, padding: "0 4px", color: "#92400e" }}>{v.match}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                    {bvStatus === "partial" && residualCount > 0 && <div style={{ height: 1, background: C.border, marginTop: 10 }} />}
                  </div>

                  {/* GEO score */}
                  <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>GEO Score</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>{score}/100</div>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "rgba(22,61,38,.1)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${score}%`, background: scoreColor, borderRadius: 4, transition: "width .4s" }} />
                    </div>
                  </div>

                  {/* 5 GEO checks */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {checks.length > 0 ? checks.map((ch, i) => {
                      const isCheckExpanded = expandedCheckIdx === i;
                      const isCheckFixing = fixingCheckIdx === i;
                      return (
                      <div key={i} style={{ borderRadius: 7, border: `1px solid ${!ch.pass && isCheckExpanded ? "rgba(249,57,67,.25)" : "transparent"}`, background: !ch.pass && isCheckExpanded ? "rgba(249,57,67,.03)" : "transparent" }}>
                        <button
                          onClick={() => !ch.pass && setExpandedCheckIdx(isCheckExpanded ? null : i)}
                          style={{ width: "100%", textAlign: "left", padding: isCheckExpanded ? "8px 8px 4px" : 0, background: "none", border: "none", cursor: ch.pass ? "default" : "pointer", display: "flex", alignItems: "flex-start", gap: 8 }}
                        >
                          <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: ch.pass ? "rgba(24,95,0,.12)" : "rgba(249,57,67,.1)" }}>
                            <svg viewBox="0 0 12 12" width="8" height="8" fill="none" stroke={ch.pass ? C.mid : C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              {ch.pass ? <path d="M2 6l3 3 5-5" /> : <><path d="M3 3l6 6"/><path d="M9 3l-6 6"/></>}
                            </svg>
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.dark, lineHeight: 1.3 }}>{ch.label}</div>
                            <div style={{ fontSize: 10, fontWeight: 400, color: "rgba(22,61,38,.58)", lineHeight: 1.4, marginTop: 2 }}>
                              {ch.evidence.length > 80 ? ch.evidence.slice(0, 80) + "…" : ch.evidence}
                            </div>
                          </div>
                          {!ch.pass && <span style={{ fontSize: 9, color: "rgba(22,61,38,.35)", flexShrink: 0, marginTop: 3 }}>{isCheckExpanded ? "▲" : "▼"}</span>}
                        </button>
                        {!ch.pass && isCheckExpanded && (
                          <div style={{ display: "flex", gap: 6, padding: "4px 8px 8px" }}>
                            <button
                              onClick={() => void autoFixGeoCheck(ch.label, i)}
                              disabled={isCheckFixing}
                              style={{ flex: 1, padding: "7px 10px", borderRadius: 6, background: C.dark, color: C.white, fontSize: 10, fontWeight: 700, border: "none", cursor: isCheckFixing ? "default" : "pointer", opacity: isCheckFixing ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                            >
                              {isCheckFixing ? <><span style={{ display: "inline-block", animation: "spin .8s linear infinite" }}>↻</span> Fixing…</> : "⚡ Auto fix"}
                            </button>
                            <button
                              onClick={() => setExpandedCheckIdx(null)}
                              style={{ padding: "7px 10px", borderRadius: 6, background: "none", color: "rgba(22,61,38,.5)", fontSize: 10, fontWeight: 600, border: `1px solid ${C.border}`, cursor: "pointer" }}
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                      );
                    }) : (
                      /* Placeholder checks while score loads */
                      ["Named sources","Statistics with sources","Cited claims","AI-tell density","FAQ fan-out coverage"].map(label => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 16, height: 6, borderRadius: 4, background: "rgba(22,61,38,.1)" }} />
                          <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.4)" }}>{label}</div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Word count + quality flags */}
                  {wordCount > 0 && (
                    <div style={{ marginTop: 12, fontSize: 11, fontWeight: 400, color: "rgba(22,61,38,.5)" }}>{wordCount.toLocaleString()} words</div>
                  )}
                  {qualityFlags.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: "rgba(22,61,38,.45)", marginBottom: 2 }}>CONTENT QUALITY — thin or missing sections</div>
                      {qualityFlags.map((f, i) => {
                        const sectionName = f.section ?? f.message.match(/^"([^"]+)"/)?.[1] ?? "";
                        const isActive = sectionName && highlightedSectionId === sectionSlug(sectionName);
                        const isExpanded = expandedFlagIdx === i;
                        const isFixing = fixingFlagIdx === i;
                        return (
                          <div key={i} style={{ borderRadius: 7, background: isActive ? "rgba(245,166,35,.08)" : "rgba(249,57,67,.05)", border: `1px solid ${isActive ? "rgba(245,166,35,.6)" : "rgba(249,57,67,.18)"}`, overflow: "hidden" }}>
                            <button
                              onClick={() => {
                                if (sectionName) scrollToSection(sectionName);
                                setExpandedFlagIdx(isExpanded ? null : i);
                              }}
                              style={{ width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: ".08em", padding: "2px 5px", borderRadius: 4, background: C.red, color: C.white }}>E{i + 1}</span>
                                {sectionName && <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(22,61,38,.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sectionName}</span>}
                                <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(22,61,38,.35)", flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 400, color: C.red, lineHeight: 1.4 }}>
                                {f.message.length > 90 ? f.message.slice(0, 90) + "…" : f.message}
                              </span>
                            </button>
                            {isExpanded && (
                              <div style={{ display: "flex", gap: 6, padding: "0 10px 10px" }}>
                                <button
                                  onClick={() => void autoFixFlag(f, i)}
                                  disabled={isFixing}
                                  style={{ flex: 1, padding: "7px 10px", borderRadius: 6, background: C.dark, color: C.white, fontSize: 10, fontWeight: 700, border: "none", cursor: isFixing ? "default" : "pointer", opacity: isFixing ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                                >
                                  {isFixing ? <><span style={{ display: "inline-block", animation: "spin .8s linear infinite" }}>↻</span> Fixing…</> : "⚡ Auto fix"}
                                </button>
                                <button
                                  onClick={() => { setQualityFlags(prev => prev.filter((_, j) => j !== i)); setExpandedFlagIdx(null); }}
                                  style={{ padding: "7px 10px", borderRadius: 6, background: "none", color: "rgba(22,61,38,.5)", fontSize: 10, fontWeight: 600, border: `1px solid ${C.border}`, cursor: "pointer" }}
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Auto fix all */}
                  {qualityFlags.length > 0 && (
                    <button
                      onClick={() => void autoFixAll()}
                      disabled={fixingAll}
                      style={{ width: "100%", marginTop: 14, padding: "10px 12px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, background: fixingAll ? "rgba(22,61,38,.55)" : C.dark, color: C.white, cursor: fixingAll ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                    >
                      {fixingAll
                        ? <><span style={{ display: "inline-block", animation: "spin .8s linear infinite" }}>↻</span>{fixAllProgress ?? "Fixing…"}</>
                        : <><span>⚡⚡⚡</span> Auto fix all ({qualityFlags.length})</>}
                    </button>
                  )}

                  {/* Re-run GEO checks */}
                  <button
                    onClick={() => void rescoreGeo()}
                    disabled={rescoring || fixingAll}
                    style={{ width: "100%", marginTop: 8, padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, background: "none", color: C.dark, cursor: (rescoring || fixingAll) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: (rescoring || fixingAll) ? 0.6 : 1 }}
                  >
                    <span style={{ fontSize: 14, display: "inline-block", animation: rescoring ? "spin .8s linear infinite" : "none" }}>↻</span>
                    {rescoring ? "Rescoring…" : "Re-run GEO checks"}
                  </button>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              </div>

              {/* ── SEO METADATA ── */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, flexShrink: 0 }}>
                {/* Header */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: articleFinalised ? C.mid : "rgba(22,61,38,.3)" }}>SEO METADATA</div>
                  {articleFinalised && (seoTitle || seoMetaDesc) && (
                    seoMetadataLoading
                      ? <span style={{ fontSize: 10, color: "rgba(22,61,38,.4)", display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ display: "inline-block", animation: "spin .8s linear infinite" }}>↻</span> Generating…
                        </span>
                      : <button onClick={() => void generateMetadata()} style={{ fontSize: 10, fontWeight: 600, color: C.mid, background: "none", border: "none", cursor: "pointer" }}>Refresh</button>
                  )}
                </div>

                {/* ── LOCKED: article not finalised ── */}
                {!articleFinalised && (
                  <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(22,61,38,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="rgba(22,61,38,.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="9" width="12" height="9" rx="2"/>
                        <path d="M7 9V6a3 3 0 016 0v3"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(22,61,38,.5)", marginBottom: 5 }}>Article not finalised</div>
                      <div style={{ fontSize: 11, color: "rgba(22,61,38,.4)", lineHeight: 1.5, maxWidth: "22ch", margin: "0 auto" }}>Complete your edits, then finalise to unlock SEO metadata.</div>
                    </div>
                    <button
                      onClick={() => setArticleFinalised(true)}
                      style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}
                    >
                      <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-5"/></svg>
                      Finalise Article
                    </button>
                  </div>
                )}

                {/* ── FINALISED: no metadata yet ── */}
                {articleFinalised && !seoTitle && !seoMetaDesc && (
                  <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "rgba(22,61,38,.5)", lineHeight: 1.5 }}>Ready to generate SEO title, meta description, tags, and slug using the article content.</div>
                    <button
                      onClick={() => void generateMetadata()}
                      disabled={seoMetadataLoading}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, background: seoMetadataLoading ? "rgba(24,95,0,.5)" : C.mid, color: C.white, fontSize: 11, fontWeight: 700, border: "none", cursor: seoMetadataLoading ? "default" : "pointer" }}
                    >
                      {seoMetadataLoading
                        ? <><span style={{ display: "inline-block", animation: "spin .8s linear infinite" }}>↻</span> Generating…</>
                        : <><svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1v10M1 6h10"/><circle cx="6" cy="6" r="5"/></svg> Generate Metadata</>
                      }
                    </button>
                  </div>
                )}

                {/* ── FINALISED: fields visible ── */}
                {articleFinalised && (seoTitle || seoMetaDesc) && (
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

                    {/* Title */}
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".09em", color: "rgba(22,61,38,.5)", marginBottom: 5 }}>Title</label>
                      <input
                        value={seoPageTitle}
                        onChange={e => setSeoPageTitle(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, fontWeight: 400, background: C.bg, color: C.dark, outline: "none" }}
                      />
                    </div>

                    {/* Slug — server-generated, read-only */}
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".09em", color: "rgba(22,61,38,.5)", marginBottom: 5 }}>Slug</label>
                      <div style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, fontWeight: 400, background: "rgba(22,61,38,.03)", color: "rgba(22,61,38,.6)", fontFamily: "monospace", wordBreak: "break-all" }}>
                        {seoSlugDisplay || "—"}
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".09em", color: "rgba(22,61,38,.5)", marginBottom: 5 }}>Tags</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7 }}>
                        {seoTags.map(tag => (
                          <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "rgba(22,61,38,.07)", color: C.dark }}>
                            {tag}
                            <button onClick={() => setSeoTags(prev => prev.filter(t => t !== tag))} style={{ fontSize: 11, lineHeight: 1, background: "none", border: "none", cursor: "pointer", color: "rgba(22,61,38,.45)", padding: 0 }}>×</button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={newTagInput}
                          onChange={e => setNewTagInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && newTagInput.trim()) { setSeoTags(prev => [...new Set([...prev, newTagInput.trim()])]); setNewTagInput(""); } }}
                          placeholder="New tag"
                          style={{ flex: 1, padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, background: C.bg, color: C.dark, outline: "none" }}
                        />
                        <button
                          onClick={() => { if (newTagInput.trim()) { setSeoTags(prev => [...new Set([...prev, newTagInput.trim()])]); setNewTagInput(""); } }}
                          style={{ padding: "7px 11px", borderRadius: 7, background: C.dark, color: C.white, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer" }}
                        >Add</button>
                      </div>
                    </div>

                    {/* SEO title */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".09em", color: "rgba(22,61,38,.5)" }}>SEO title (≤ 60 chars)</label>
                        <span style={{ fontSize: 10, fontWeight: 600, color: seoTitle.length > 60 ? C.red : "rgba(22,61,38,.4)" }}>{seoTitle.length}/60</span>
                      </div>
                      <input
                        value={seoTitle}
                        onChange={e => setSeoTitle(e.target.value)}
                        maxLength={70}
                        style={{ width: "100%", padding: "8px 10px", border: `1px solid ${seoTitle.length > 60 ? C.red : C.border}`, borderRadius: 7, fontSize: 11, background: C.bg, color: C.dark, outline: "none" }}
                      />
                    </div>

                    {/* Meta description */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".09em", color: "rgba(22,61,38,.5)" }}>Meta description (≤ 160 chars)</label>
                        <span style={{ fontSize: 10, fontWeight: 600, color: seoMetaDesc.length > 160 ? C.red : "rgba(22,61,38,.4)" }}>{seoMetaDesc.length}/160</span>
                      </div>
                      <textarea
                        value={seoMetaDesc}
                        onChange={e => setSeoMetaDesc(e.target.value)}
                        rows={3}
                        maxLength={180}
                        placeholder="Write a compelling meta description…"
                        style={{ width: "100%", padding: "8px 10px", border: `1px solid ${seoMetaDesc.length > 160 ? C.red : C.border}`, borderRadius: 7, fontSize: 11, lineHeight: 1.5, background: C.bg, color: C.dark, outline: "none", resize: "vertical" }}
                      />
                    </div>

                    {/* Un-finalise link */}
                    <button
                      onClick={() => setArticleFinalised(false)}
                      style={{ alignSelf: "flex-start", fontSize: 10, fontWeight: 500, color: "rgba(22,61,38,.35)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}
                    >
                      Unlock for editing
                    </button>
                  </div>
                )}
              </div>

              {/* ── PUBLISH ── */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, flexShrink: 0 }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: C.mid }}>PUBLISH</div>
                </div>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Draft status */}
                  {draftState === "success" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, background: "rgba(24,95,0,.07)", border: "1px solid rgba(24,95,0,.18)" }}>
                      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke={C.mid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-5"/></svg>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.mid }}>Saved as draft in Sanity</span>
                    </div>
                  )}
                  {draftState === "error" && (
                    <div style={{ padding: "9px 12px", borderRadius: 8, background: "rgba(249,57,67,.07)", border: "1px solid rgba(249,57,67,.22)", fontSize: 11, color: C.red }}>{draftError}</div>
                  )}
                  {/* Save inside tool (localStorage + Supabase) */}
                  <button
                    onClick={async () => {
                      if (!activeCardId || !articleData) return;
                      writeCardCache(activeCardId, {
                        editorStep, outline, articleTitle, articleData,
                        geoScore, qualityFlags, brandVoiceStatus,
                        seoPageTitle, seoTitle, seoSlug, seoMetaDesc, seoTags,
                        articleFinalised, seoExcerpt, seoFocusKeyword,
                        savedAt: new Date().toISOString(),
                      });
                      // Also persist to Supabase so restore-article always returns the latest version
                      fetch(`/api/builder-sessions/${activeCardId}/save-article`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ article: articleData }),
                      }).catch(() => {/* non-fatal */});
                      setIsSaved(true);
                    }}
                    disabled={!articleData}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: `1.5px solid ${isSaved ? C.mid : C.border}`, background: isSaved ? "rgba(24,95,0,.07)" : C.faint, color: isSaved ? C.mid : C.dark, cursor: !articleData ? "default" : "pointer", opacity: !articleData ? 0.45 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "border-color .2s, background .2s, color .2s" }}
                  >
                    {isSaved ? (
                      <>
                        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-5"/></svg>
                        Saved
                      </>
                    ) : autoSaving ? (
                      <>
                        <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M11 13H3a1 1 0 01-1-1V2a1 1 0 011-1h6l3 3v8a1 1 0 01-1 1z"/><path d="M9 13V8H5v5M5 1v4h4"/></svg>
                        Auto-saving…
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 13H3a1 1 0 01-1-1V2a1 1 0 011-1h6l3 3v8a1 1 0 01-1 1z"/><path d="M9 13V8H5v5M5 1v4h4"/></svg>
                        Save
                      </>
                    )}
                  </button>
                  {/* Send to Sanity draft button */}
                  <button
                    onClick={() => void sendToDraftSanity()}
                    disabled={draftState === "loading" || !articleData}
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, background: "none", color: C.dark, cursor: draftState === "loading" || !articleData ? "default" : "pointer", opacity: !articleData ? 0.45 : 1 }}
                  >
                    {draftState === "loading" ? "Saving…" : draftState === "success" ? "Update draft in Sanity" : "Save as draft in Sanity"}
                  </button>
                  {/* Publish live button */}
                  {liveState === "success" && liveUrl ? (
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "10px 12px", borderRadius: 8, background: C.mid, color: C.white, fontSize: 12, fontWeight: 700, border: "none", textDecoration: "none" }}>
                      <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1v8M3 5l4 4 4-4M1 11h12"/></svg>
                      View live article
                    </a>
                  ) : (
                    <button
                      onClick={() => void publishLive()}
                      disabled={liveState === "loading" || !articleData}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: C.dark, color: C.white, fontSize: 12, fontWeight: 700, border: "none", cursor: liveState === "loading" || !articleData ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: !articleData ? 0.45 : 1 }}
                    >
                      <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1v8M3 5l4 4 4-4M1 11h12"/></svg>
                      {liveState === "loading" ? "Publishing…" : "Publish live on website"}
                    </button>
                  )}
                  {liveState === "error" && (
                    <div style={{ padding: "9px 12px", borderRadius: 8, background: "rgba(249,57,67,.07)", border: "1px solid rgba(249,57,67,.22)", fontSize: 11, color: C.red }}>{liveError}</div>
                  )}
                </div>
              </div>

            </aside>
          </div>
        );
      })()}
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
  const [hoveredBar, setHoveredBar] = useState<{ idx: number; date: string; usd: number; calls: number } | null>(null);

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

          {/* Daily chart — full date range, zero-filled for days with no data */}
          {(() => {
            const fullRange: { date: string; estimatedUsd: number; calls: number }[] = [];
            const today = new Date();
            for (let i = days - 1; i >= 0; i--) {
              const d = new Date(today);
              d.setDate(d.getDate() - i);
              const dateStr = d.toISOString().slice(0, 10);
              const found = data.byDay.find(b => b.date === dateStr);
              fullRange.push({ date: dateStr, estimatedUsd: found?.estimatedUsd ?? 0, calls: (found as { calls?: number })?.calls ?? 0 });
            }
            const rangeMax = Math.max(...fullRange.map(d => d.estimatedUsd), 0.000001);
            const labelEvery = days <= 7 ? 1 : days <= 30 ? 5 : 10;
            const barGap = days > 30 ? 2 : 3;
            return (
              <div style={{ padding: "20px 24px", background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", opacity: .55 }}>DAILY SPEND</div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {fullRange.filter(d => d.estimatedUsd > 0).length} active days · peak {fmtUsd(rangeMax)}
                  </div>
                </div>

                {/* Bars + tooltip */}
                <div style={{ position: "relative" }}>
                  {/* Custom tooltip */}
                  {hoveredBar && (
                    <div style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: `clamp(0px, calc(${(hoveredBar.idx / fullRange.length) * 100}% - 60px), calc(100% - 130px))`,
                      background: C.dark,
                      color: C.white,
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      zIndex: 10,
                      boxShadow: "0 4px 12px rgba(0,0,0,.18)",
                      lineHeight: 1.6,
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{hoveredBar.date}</div>
                      {hoveredBar.usd > 0 ? (
                        <>
                          <div style={{ color: "rgba(255,255,255,.85)" }}>{fmtUsd(hoveredBar.usd)}</div>
                          <div style={{ color: "rgba(255,255,255,.55)", fontSize: 11 }}>{hoveredBar.calls} call{hoveredBar.calls !== 1 ? "s" : ""}</div>
                        </>
                      ) : (
                        <div style={{ color: "rgba(255,255,255,.45)" }}>No usage</div>
                      )}
                    </div>
                  )}

                  {/* Bar columns */}
                  <div
                    style={{ display: "flex", alignItems: "flex-end", gap: barGap, height: 110 }}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {fullRange.map((d, i) => {
                      const pct = (d.estimatedUsd / rangeMax) * 100;
                      const hasData = d.estimatedUsd > 0;
                      const isHovered = hoveredBar?.idx === i;
                      return (
                        <div
                          key={d.date}
                          onMouseEnter={() => setHoveredBar({ idx: i, date: d.date, usd: d.estimatedUsd, calls: d.calls })}
                          style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", cursor: "default" }}
                        >
                          <div style={{
                            width: "100%",
                            height: hasData ? `${Math.max(pct, 4)}%` : "2px",
                            background: hasData ? (isHovered ? C.dark : C.mid) : (isHovered ? "rgba(22,61,38,.2)" : "rgba(22,61,38,.1)"),
                            borderRadius: "3px 3px 0 0",
                            transition: "background .1s, height .1s",
                          }} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Date axis — absolutely positioned so labels never get clipped by bar width */}
                <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 0 }} />
                <div style={{ position: "relative", height: 24, marginTop: 2 }}>
                  {(() => {
                    // Build label positions as % of total width
                    type LabelPos = { pct: number; text: string; key: string; bold?: boolean };
                    const labels: LabelPos[] = [];
                    const n = fullRange.length;

                    if (days <= 7) {
                      // Every day
                      fullRange.forEach((d, i) => {
                        labels.push({ pct: (i + 0.5) / n * 100, text: d.date.slice(5), key: d.date });
                      });
                    } else if (days <= 30) {
                      // Every 5 days + last
                      fullRange.forEach((d, i) => {
                        if (i === 0 || i % 5 === 0 || i === n - 1)
                          labels.push({ pct: (i + 0.5) / n * 100, text: d.date.slice(5), key: d.date });
                      });
                    } else {
                      // 90d: month start markers + first + last day of range
                      fullRange.forEach((d, i) => {
                        const dt = new Date(d.date + "T00:00:00");
                        const isMonthStart = dt.getDate() === 1;
                        const isFirst = i === 0;
                        const isLast = i === n - 1;
                        if (isMonthStart || isFirst || isLast) {
                          const text = isMonthStart
                            ? dt.toLocaleString("default", { month: "short" })
                            : d.date.slice(5);
                          labels.push({ pct: (i + 0.5) / n * 100, text, key: d.date });
                        }
                      });
                    }

                    // Hovered bar label overrides — show exact date
                    const hoveredLabel = hoveredBar
                      ? { pct: (hoveredBar.idx + 0.5) / n * 100, text: hoveredBar.date.slice(5), key: "hover", bold: true }
                      : null;

                    return [...labels, ...(hoveredLabel ? [hoveredLabel] : [])].map(l => (
                      <span
                        key={l.key}
                        style={{
                          position: "absolute",
                          left: `${l.pct}%`,
                          transform: "translateX(-50%)",
                          fontSize: 10,
                          fontWeight: l.bold ? 700 : 400,
                          color: l.bold ? C.dark : C.muted,
                          whiteSpace: "nowrap",
                          userSelect: "none",
                          lineHeight: 1,
                          top: 4,
                        }}
                      >
                        {l.text}
                      </span>
                    ));
                  })()}
                </div>
              </div>
            );
          })()}

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
                  return <div style={{ height: "100%", width: `${pct}%`, background: CREDIT_BAR_GRADIENT, backgroundSize: `${(10000 / Math.max(pct, 0.1)).toFixed(0)}% 100%`, borderRadius: 4, transition: "width .3s" }} />;
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
          <div key={card.opportunityId} style={{ padding: 24, border: "1px solid rgba(22,61,38,.09)", borderRadius: 12, background: C.white, opacity: 0.82, display: "flex", flexDirection: "column", height: 260 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "rgba(22,61,38,.4)", marginBottom: 12 }}>DELETED</div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: C.dark, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {card.brief.prompt ?? "Untitled brief"}
            </div>
            {card.brief.format && (
              <div style={{ fontSize: 12, fontWeight: 400, color: C.muted, marginBottom: 6 }}>{card.brief.format}</div>
            )}
            {card.brief.client && (
              <div style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 12, background: C.faint, color: C.dark, width: "fit-content", marginBottom: 6 }}>{card.brief.client}</div>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: "rgba(22,61,38,.38)", marginBottom: 16, paddingTop: 12, borderTop: "1px solid rgba(22,61,38,.07)" }}>
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
  const [presenceData, setPresenceData] = useState<PresenceUser[]>([]);
  const { data: settings } = useSettings();

  // ── Presence: write own state, poll others ────────────────────────────────
  const writePresence = (cardId: string | null) => {
    fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId }) }).catch(() => {});
  };

  useEffect(() => {
    // Write on mount
    writePresence(null);
    // Heartbeat every 30s
    const hb = setInterval(() => { writePresence(activeCardId); }, 30_000);
    // Clear presence on unload
    const onUnload = () => { navigator.sendBeacon("/api/presence", JSON.stringify({ cardId: null })); };
    window.addEventListener("beforeunload", onUnload);
    return () => { clearInterval(hb); window.removeEventListener("beforeunload", onUnload); writePresence(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write presence whenever the active card changes
  useEffect(() => { writePresence(activeCardId); }, [activeCardId]);

  // Poll others' presence every 8s
  useEffect(() => {
    const poll = () => {
      fetch("/api/presence")
        .then(r => r.ok ? r.json() as Promise<PresenceUser[]> : [])
        .then(data => setPresenceData(data))
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, 8_000);
    return () => clearInterval(t);
  }, []);

  // ── URL persistence: restore screen + active card on refresh ─────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedCard = params.get("card");
    const savedScreen = params.get("screen") as Screen | null;
    const validScreens: Screen[] = ["dashboard", "generate", "editor", "queue", "settings"];
    if (savedCard) {
      // Card takes priority — always opens editor
      setActiveCardId(savedCard);
      setScreen("editor");
    } else if (savedScreen && validScreens.includes(savedScreen)) {
      setScreen(savedScreen);
    }
  }, []);

  // Keep URL in sync with current screen + card
  useEffect(() => {
    const params = new URLSearchParams();
    if (screen !== "dashboard") params.set("screen", screen);
    if (activeCardId) params.set("card", activeCardId);
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
  }, [screen, activeCardId]);

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
              creatorEmail: (s as { creatorEmail?: string }).creatorEmail,
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

  function handleActivateCard(id: string) {
    if (presenceData.some(u => u.active_card_id === id)) return;
    setActiveCardId(id);
  }

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
        @keyframes pulse { 0%,100%{opacity:.35}50%{opacity:.7} }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(22,61,38,.06); border-radius: 8px; }
        ::-webkit-scrollbar-thumb { background: rgba(22,61,38,.28); border-radius: 8px; }
        mark[data-bv-violation] { background:#fef3c7;color:#92400e;border-radius:2px;padding:0 2px;outline:1px solid #f59e0b; }
        .v2-masthead mark[data-bv-violation] { background:#f59e0b;color:#1c1917;outline:1px solid #d97706; }
        .v2-rich ol, .v2-rich ul { margin: 10px 0 10px 22px; padding: 0; }
        .v2-rich li { margin-bottom: 5px; font-size: inherit; line-height: 1.65; color: inherit; }
        .v2-rich strong, .v2-rich b { font-weight: 600; }
        .v2-rich em, .v2-rich i { font-style: italic; }
        .v2-rich--inv li { color: rgba(255,255,255,.8); }
        .v2-rich--inv ul { list-style: none; margin-left: 0; padding-left: 0; }
        .v2-rich--inv ul li { padding-left: 20px; position: relative; }
        .v2-rich--inv ul li::before { content: ""; position: absolute; left: 0; top: 7px; width: 7px; height: 7px; border-radius: 50%; background: #F88379; }

        /* Sidebar nav item hover animations */
        .v2-nav-btn {
          transition: background .14s ease, transform .13s ease;
          position: relative;
        }

        /* ── Expanded (text + icon) ───────────────────────────── */
        .v2-nav-btn::before {
          content: "";
          position: absolute;
          left: 0; top: 20%; bottom: 20%;
          width: 2.5px;
          border-radius: 0 2px 2px 0;
          background: rgba(255,255,255,.0);
          transition: background .14s ease, top .14s ease, bottom .14s ease;
        }
        .v2-nav-btn:not(.v2-nav-collapsed):not(.v2-nav-active):hover {
          background: rgba(255,255,255,.08) !important;
        }
        .v2-nav-btn:not(.v2-nav-collapsed):not(.v2-nav-active):hover::before {
          background: rgba(255,255,255,.3);
          top: 25%; bottom: 25%;
        }
        .v2-nav-btn:not(.v2-nav-collapsed):not(.v2-nav-active):hover .v2-nav-icon {
          opacity: 0.9 !important;
          transform: translateX(2px);
        }
        .v2-nav-btn:not(.v2-nav-collapsed):not(.v2-nav-active):hover .v2-nav-label {
          transform: translateX(2px);
        }
        .v2-nav-active:not(.v2-nav-collapsed)::before {
          background: rgba(255,255,255,.55);
          top: 18%; bottom: 18%;
        }

        /* ── Collapsed (icon only) ────────────────────────────── */
        .v2-nav-btn.v2-nav-collapsed:not(.v2-nav-active):hover {
          background: rgba(255,255,255,.1) !important;
        }
        .v2-nav-btn.v2-nav-collapsed:not(.v2-nav-active):hover .v2-nav-icon {
          opacity: 1 !important;
          transform: translateY(-2px) scale(1.18);
          filter: drop-shadow(0 2px 4px rgba(0,0,0,.25));
        }
        .v2-nav-btn.v2-nav-collapsed:active { transform: scale(0.92); }

        /* ── Shared ───────────────────────────────────────────── */
        .v2-nav-btn:not(.v2-nav-collapsed):active { transform: scale(0.97); }
        .v2-nav-icon {
          transition: opacity .14s ease, transform .16s cubic-bezier(.34,1.56,.64,1), filter .14s ease;
        }
        .v2-nav-label {
          transition: transform .14s ease;
        }
      `}</style>

      <Sidebar
        screen={screen}
        setScreen={(s: Screen) => {
          // Clicking "Draft editor" from inside an article returns to the card grid
          if (s === "editor") setActiveCardId(null);
          setScreen(s);
        }}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        creditPct={creditPct}
        creditLabel={creditLabel}
        onUsageClick={() => setScreen("usage")}
      />

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {screen !== "editor" && <PageHeader screen={screen} onGenerate={go("generate")} onKeywords={go("keywords")} />}

        <div style={{ flex: 1, padding: "32px 40px 64px" }}>
          {screen === "dashboard"  && <DashboardScreen dataState={dataState} onGenerate={go("generate")} onQueue={go("queue")} onEditor={go("editor")} onAnalytics={go("analytics")} />}
          {screen === "generate"   && <GenerateScreen onSettings={go("settings")} onQueue={go("queue")} onSessionCreated={handleSessionCreated} seedKeywords={settings?.seed_keywords ?? []} defaultFlow={generateDefaultFlow} />}
          {screen === "queue"      && <QueueScreen onEditor={go("editor")} onGenerate={go("generate")} />}
          {screen === "editor"     && <EditorScreen onScore={go("score")} onPublish={go("publish")} draftCards={draftCards} activeCardId={activeCardId} onActivateCard={handleActivateCard} onBackToCards={handleBackToCards} onResumeChat={handleResumeChat} onTrashCard={handleTrashCard} presenceData={presenceData} />}
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

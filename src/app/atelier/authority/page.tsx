"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import {
  Users, Eye, Timer, BarChart3, Globe, Sparkles, TrendingUp,
  AlertCircle, ArrowUpRight, Zap, Bot, Award, MessageSquareQuote, FileText,
  Activity, ShieldCheck, Radar, Clock, CalendarIcon, ChevronDown,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, subDays } from "date-fns";
import type { DateRange as DayPickerDateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OrganicLoader } from "@/components/ui/organic-loader";
import { DonutChart, type DonutChartSegment } from "@/components/ui/donut-chart";
import { ActivityStatsCard } from "@/components/ui/activity-stats-card";
import { MinimalStepsCard } from "@/components/ui/minimal-steps-card";
import { MiniChart, type MiniChartDataPoint } from "@/components/ui/mini-chart";
import { cn } from "@/lib/utils";

// ─── Bot / LLM logo helper ────────────────────────────────────────────────

const BOT_DOMAINS: Record<string, string> = {
  "GPTBot":          "openai.com",
  "ChatGPT":         "openai.com",
  "PerplexityBot":   "perplexity.ai",
  "Perplexity":      "perplexity.ai",
  "ClaudeBot":       "anthropic.com",
  "Claude":          "anthropic.com",
  "Google-Extended": "google.com",
  "Googlebot":       "google.com",
  "Applebot":        "apple.com",
  "Gemini":          "gemini.google.com",
};

function BotLogo({ name, size = 20 }: { name: string; size?: number }) {
  const domain = BOT_DOMAINS[name];
  if (!domain) {
    return (
      <span
        className="flex items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500"
        style={{ width: size, height: size }}
      >
        {name[0]}
      </span>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt={name}
      width={size}
      height={size}
      className="rounded-sm"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// ─── Types ────────────────────────────────────────────────────────────────

interface AnalyticsData {
  kpis: { sessions: number; users: number; pageviews: number; bounceRate: number; avgEngagementSec: number };
  trafficSources: { channel: string; sessions: number; users: number; percentage: number }[];
  aiBreakdown: { source: string; sessions: number; users: number; percentage: number }[];
  topPages: { path: string; pageviews: number; avgEngagementSec: number }[];
  topCountries: { country: string; sessions: number; percentage: number }[];
  dateRange: { start: string; end: string };
  isMock: boolean;
  error?: string;
  connection?: { connected: boolean; gaPropertyId?: string; gaPropertyDisplayName?: string; reason?: string };
}

type GlobalPeriod = "weekly" | "monthly" | "yearly" | "custom";
type LP = "week" | "month" | "year"; // local section period
type Tab = "web" | "ai";

const GLOBAL_PERIOD_DAYS: Record<Exclude<GlobalPeriod, "custom">, number> = {
  weekly: 7, monthly: 30, yearly: 365,
};

// ─── Mock scaling ─────────────────────────────────────────────────────────

const LP_SCALE: Record<LP, number> = { week: 0.23, month: 1, year: 11.4 };
const LP_VS: Record<LP, string> = { week: "vs last week", month: "vs last month", year: "vs last year" };
const LP_BARS: Record<LP, number> = { week: 7, month: 4, year: 12 };
const LP_BAR_LABEL: Record<LP, string[]> = {
  week:  ["M", "T", "W", "T", "F", "S", "S"],
  month: ["W1", "W2", "W3", "W4"],
  year:  ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
};

function scaleNum(base: number, p: LP) { return Math.round(base * LP_SCALE[p]); }

function scaledKpis(base: AnalyticsData["kpis"], p: LP) {
  return {
    sessions:        scaleNum(base.sessions, p),
    users:           scaleNum(base.users, p),
    pageviews:       scaleNum(base.pageviews, p),
    bounceRate:      +(base.bounceRate + (p === "week" ? 2.1 : p === "year" ? -2.8 : 0)).toFixed(1),
    avgEngagementSec: Math.round(base.avgEngagementSec + (p === "week" ? -12 : p === "year" ? 18 : 0)),
  };
}

function scaledAiBreakdown(base: AnalyticsData["aiBreakdown"], p: LP) {
  return base.map((item) => ({ ...item, sessions: scaleNum(item.sessions, p) }));
}

function scaledTrafficSources(base: AnalyticsData["trafficSources"], p: LP) {
  return base.map((item) => ({ ...item, sessions: scaleNum(item.sessions, p) }));
}

function scaledTopPages(base: AnalyticsData["topPages"], p: LP) {
  return base.map((item) => ({ ...item, pageviews: scaleNum(item.pageviews, p) }));
}

function scaledCountries(base: AnalyticsData["topCountries"], p: LP) {
  return base.map((item) => ({ ...item, sessions: scaleNum(item.sessions, p) }));
}

function scaledBotCrawlers(base: typeof MOCK_BOT_CRAWLERS, p: LP) {
  return base.map((b) => ({ ...b, crawls: scaleNum(b.crawls, p) }));
}

function generateActivityBars(baseValues: number[], prevMultiplier: number, p: LP) {
  const labels = LP_BAR_LABEL[p];
  const n = LP_BARS[p];
  return Array.from({ length: n }, (_, i) => ({
    label: labels[i],
    currentValue: Math.round((baseValues[i % baseValues.length] ?? 50) * LP_SCALE[p]),
    previousValue: Math.round((baseValues[i % baseValues.length] ?? 50) * LP_SCALE[p] * prevMultiplier),
  }));
}

const WEEK_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const YEAR_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function lpToDays(p: LP) { return p === "week" ? 7 : p === "month" ? 30 : 365; }

function sectionDateLabel(p: LP): string {
  const end = new Date();
  const start = subDays(end, lpToDays(p));
  return `${format(start, "MMM d, yyyy")} — ${format(end, "MMM d, yyyy")}`;
}

function sectionDateShort(p: LP): string {
  const end = new Date();
  const start = subDays(end, lpToDays(p));
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

function generateDailySessions(days: number): MiniChartDataPoint[] {
  if (days <= 7) {
    return WEEK_LABELS.map((label, i) => ({
      label,
      value: Math.round(180 + Math.sin(i * 0.6) * 40 + Math.random() * 60 + (i > 4 ? 20 : 0)),
    }));
  }
  if (days <= 31) {
    return Array.from({ length: 30 }, (_, i) => ({
      label: `${i + 1}`,
      value: Math.round(40 + Math.sin(i * 0.6) * 15 + Math.random() * 20 + (i > 20 ? 10 : 0)),
    }));
  }
  return YEAR_LABELS.map((label, i) => ({
    label,
    value: Math.round(120 + Math.sin(i * 0.5) * 35 + Math.random() * 40 + (i > 7 ? 15 : 0)),
  }));
}

// ─── Color maps ────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  "AI / LLM": "bg-violet-500", "Organic Search": "bg-emerald-500",
  Direct: "bg-slate-400", Referral: "bg-blue-500", Social: "bg-pink-500",
  "Paid Search": "bg-amber-500", Email: "bg-cyan-500", Other: "bg-gray-300",
};

const AI_SOURCE_COLORS: Record<string, string> = {
  "chatgpt.com": "bg-emerald-500", "perplexity.ai": "bg-blue-500",
  "gemini.google.com": "bg-amber-500", "claude.ai": "bg-orange-400",
  "copilot.microsoft.com": "bg-cyan-500",
};

const COUNTRY_FLAGS: Record<string, string> = {
  France: "🇫🇷", "United States": "🇺🇸", "United Kingdom": "🇬🇧",
  Germany: "🇩🇪", Spain: "🇪🇸", Italy: "🇮🇹", Netherlands: "🇳🇱",
  Belgium: "🇧🇪", Canada: "🇨🇦", Switzerland: "🇨🇭",
};

const DONUT_COLORS: Record<string, string> = {
  "AI / LLM": "#8b5cf6", "Organic Search": "#10b981", Direct: "#94a3b8",
  Referral: "#3b82f6", Social: "#ec4899", "Paid Search": "#f59e0b",
  Email: "#06b6d4", Other: "#d1d5db",
};

// ─── Sparklines & trends ───────────────────────────────────────────────────

const SPARKLINES: Record<string, number[]> = {
  sessions:   [0.55, 0.62, 0.58, 0.71, 0.68, 0.80, 0.74],
  users:      [0.50, 0.58, 0.54, 0.66, 0.72, 0.78, 0.70],
  pageviews:  [0.60, 0.55, 0.70, 0.65, 0.75, 0.82, 0.77],
  bounceRate: [0.70, 0.65, 0.68, 0.60, 0.55, 0.58, 0.52],
  avgTime:    [0.40, 0.50, 0.55, 0.60, 0.58, 0.65, 0.68],
};

const MOCK_TRENDS: Record<LP, Record<string, { value: string; up: boolean }>> = {
  week: {
    sessions: { value: "+6%", up: true }, users: { value: "+4%", up: true },
    pageviews: { value: "+8%", up: true }, bounceRate: { value: "-1%", up: true },
    avgTime: { value: "+9%", up: true },
  },
  month: {
    sessions: { value: "+14%", up: true }, users: { value: "+9%", up: true },
    pageviews: { value: "+18%", up: true }, bounceRate: { value: "-4%", up: true },
    avgTime: { value: "+22%", up: true },
  },
  year: {
    sessions: { value: "+41%", up: true }, users: { value: "+35%", up: true },
    pageviews: { value: "+52%", up: true }, bounceRate: { value: "-9%", up: true },
    avgTime: { value: "+61%", up: true },
  },
};

// ─── Mock AI Authority data ────────────────────────────────────────────────

const MOCK_AUTHORITY_SCORE = 63;

const MOCK_BOT_CRAWLERS = [
  { name: "GPTBot",          crawls: 847,  lastSeen: "2h ago",  color: "bg-emerald-500" },
  { name: "PerplexityBot",   crawls: 512,  lastSeen: "4h ago",  color: "bg-blue-500"    },
  { name: "ClaudeBot",       crawls: 389,  lastSeen: "6h ago",  color: "bg-orange-400"  },
  { name: "Google-Extended", crawls: 276,  lastSeen: "12h ago", color: "bg-amber-500"   },
  { name: "Applebot",        crawls: 143,  lastSeen: "1d ago",  color: "bg-pink-500"    },
];

const MOCK_CITATION_MOMENTS = [
  { query: "What is GEO content optimisation?",         model: "ChatGPT",    page: "/insights/geo-explained",      ago: "2d ago" },
  { query: "Best AI content tools for marketers",       model: "Perplexity", page: "/dashboard",                   ago: "3d ago" },
  { query: "How to rank in AI search engines in 2026",  model: "Claude",     page: "/insights/ai-ranking",         ago: "5d ago" },
  { query: "GEO vs SEO: what's the difference?",        model: "ChatGPT",    page: "/insights/geo-vs-seo",         ago: "6d ago" },
  { query: "AI To Market platform review",              model: "Gemini",     page: "/",                            ago: "8d ago" },
];

const MOCK_TOP_CITED_PAGES = [
  { path: "/insights/geo-explained",    citations: 24, trend: "+8" },
  { path: "/insights/ai-ranking",       citations: 17, trend: "+3" },
  { path: "/",                          citations: 12, trend: "+2" },
  { path: "/insights/geo-vs-seo",       citations: 9,  trend: "+5" },
  { path: "/atelier/article-builder", citations: 6,  trend: "+1" },
];

const MOCK_VOICE_SHARE = [
  { name: "AI To Market", pct: 14, color: "bg-violet-500" },
  { name: "Competitor A", pct: 31, color: "bg-slate-300"  },
  { name: "Competitor B", pct: 22, color: "bg-slate-300"  },
  { name: "Competitor C", pct: 18, color: "bg-slate-300"  },
  { name: "Others",       pct: 15, color: "bg-slate-200"  },
];

const MOCK_GEO_SCORE = 78;
const MOCK_CITATION_RATE = 45;
const MOCK_FRESHNESS_DAYS = 2.4;

const CHATGPT_BASE  = [72, 68, 85, 78, 92, 40, 30];
const PERPLEXITY_BASE = [22, 19, 28, 24, 31, 12, 8];
const CLAUDE_BASE   = [5,  7,  9,  6,  11, 3,  2];

// ─── Utility ──────────────────────────────────────────────────────────────

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    const steps = 40;
    const step = (target - from) / steps;
    let current = from;
    const id = setInterval(() => {
      current += step;
      if ((step > 0 && current >= target) || (step < 0 && current <= target)) {
        setVal(target); clearInterval(id);
      } else { setVal(Math.round(current)); }
    }, duration / steps);
    return () => clearInterval(id);
  }, [target, duration]);
  return val;
}

// ─── Mini period toggle ────────────────────────────────────────────────────

function MiniPeriodToggle({ value, onChange }: { value: LP; onChange: (p: LP) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {(["week", "month", "year"] as LP[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "rounded-md px-2.5 py-0.5 text-xs font-semibold capitalize transition-all",
            value === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"
          )}
        >
          {p === "week" ? "W" : p === "month" ? "M" : "Y"}
        </button>
      ))}
    </div>
  );
}

// ─── Shared primitives ─────────────────────────────────────────────────────

function Sparkline({ points, color = "#14532d" }: { points: number[]; color?: string }) {
  const w = 80, h = 32, pad = 2;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map((v) => pad + (1 - v) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
  const fill = [...xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`), `L ${xs[xs.length-1]} ${h} L ${xs[0]} ${h} Z`].join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={fill} fill={color} fillOpacity="0.08" />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.max(pct, 1)), delay + 80);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${width}%`, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
    </div>
  );
}

function KpiCard({ icon, label, value, raw, sparkKey, trendKey, period }: {
  icon: React.ReactNode; label: string; value: string; raw: number;
  sparkKey: keyof typeof SPARKLINES; trendKey: string; period: LP;
}) {
  const animated = useCountUp(raw);
  const display = raw >= 1_000_000 ? `${(animated / 1_000_000).toFixed(1)}M`
    : raw >= 1_000 ? `${(animated / 1_000).toFixed(1)}K`
    : animated.toLocaleString();
  const trend = MOCK_TRENDS[period][trendKey];
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50">{icon}</div>
        {trend && (
          <span className={cn("flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
            trend.up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
            <ArrowUpRight className="h-3 w-3" />{trend.value}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{display || value}</p>
      </div>
      <div className="mt-3"><Sparkline points={SPARKLINES[sparkKey]} /></div>
    </div>
  );
}

function SectionCard({ title, icon, children, className, actions, subtitle }: {
  title?: string; icon?: React.ReactNode; children: React.ReactNode;
  className?: string; actions?: React.ReactNode; subtitle?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-100 bg-white p-6 shadow-sm", className)}>
      {title && (
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon && <div className="text-slate-400">{icon}</div>}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">{title}</h2>
              {subtitle && <p className="text-xs font-medium text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── AI Authority gauge & score pill ──────────────────────────────────────

function AuthorityGauge({ score }: { score: number }) {
  const animated = useCountUp(score, 1200);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (animated / 100) * circumference;
  const color = score >= 70 ? "#8b5cf6" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Strong" : score >= 40 ? "Growing" : "Needs work";
  const labelColor = score >= 70 ? "text-violet-600" : score >= 40 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden>
          <circle cx="70" cy="70" r="54" fill="none" stroke="#f1f5f9" strokeWidth="12" />
          <circle cx="70" cy="70" r="54" fill="none" stroke={color} strokeWidth="12"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-black tabular-nums text-slate-900">{animated}</span>
          <span className="text-xs font-semibold text-slate-400">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <span className={cn("text-sm font-bold", labelColor)}>{label}</span>
        <p className="text-xs text-slate-400 mt-0.5">AI Authority Score</p>
      </div>
    </div>
  );
}

function ScorePill({ value, label, sublabel, color, icon }: {
  value: string; label: string; sublabel?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", color)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-black tabular-nums text-slate-900 leading-none mt-0.5">{value}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

// ─── Traffic Sources Donut ─────────────────────────────────────────────────

function TrafficSourcesDonut({ sources }: { sources: { channel: string; sessions: number; percentage: number }[] }) {
  const [hovered, setHovered] = useState<DonutChartSegment | null>(null);
  const segments: DonutChartSegment[] = sources.map((s) => ({
    label: s.channel, value: s.sessions, color: DONUT_COLORS[s.channel] ?? "#d1d5db",
  }));
  const total = sources.reduce((sum, s) => sum + s.sessions, 0);
  const active = hovered ?? null;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <DonutChart
        data={segments} size={180} strokeWidth={22} onSegmentHover={setHovered}
        centerContent={
          <AnimatePresence mode="wait">
            <motion.div key={active?.label ?? "total"}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}
              className="flex flex-col items-center text-center"
            >
              <p className="text-xs font-medium text-slate-400 truncate max-w-[90px]">{active?.label ?? "Total"}</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {active ? formatNumber(active.value as number) : formatNumber(total)}
              </p>
              {active && <p className="text-xs text-slate-400">{sources.find((s) => s.channel === active.label)?.percentage ?? 0}%</p>}
            </motion.div>
          </AnimatePresence>
        }
      />
      <div className="flex-1 w-full space-y-2">
        {sources.map((s) => (
          <div key={s.channel}
            className={cn("flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors", hovered?.label === s.channel ? "bg-slate-50" : "")}
            onMouseEnter={() => setHovered({ label: s.channel, value: s.sessions, color: DONUT_COLORS[s.channel] ?? "#d1d5db" })}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[s.channel] ?? "#d1d5db" }} />
              <span className="text-sm font-medium text-slate-700">{s.channel}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-600">{formatNumber(s.sessions)}</span>
              <span className="w-8 text-right">{s.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab content: Web Analytics ────────────────────────────────────────────

function WebAnalyticsTab({ data }: { data: AnalyticsData }) {
  const [kpiPeriod,      setKpiPeriod]      = useState<LP>("month");
  const [aiPeriod,       setAiPeriod]       = useState<LP>("month");
  const [timelinePeriod, setTimelinePeriod] = useState<LP>("month");
  const [sourcesPeriod,  setSourcesPeriod]  = useState<LP>("month");
  const [pagesPeriod,    setPagesPeriod]    = useState<LP>("month");
  const [countriesPeriod,setCountriesPeriod]= useState<LP>("month");

  const kpis      = useMemo(() => scaledKpis(data.kpis, kpiPeriod), [data.kpis, kpiPeriod]);
  const aiBreakdown = useMemo(() => scaledAiBreakdown(data.aiBreakdown, aiPeriod), [data.aiBreakdown, aiPeriod]);
  const aiSessions  = useMemo(() => {
    const src = scaledTrafficSources(data.trafficSources, aiPeriod);
    return src.find((t) => t.channel === "AI / LLM")?.sessions ?? 0;
  }, [data.trafficSources, aiPeriod]);
  const sources   = useMemo(() => scaledTrafficSources(data.trafficSources, sourcesPeriod), [data.trafficSources, sourcesPeriod]);
  const pages     = useMemo(() => scaledTopPages(data.topPages, pagesPeriod), [data.topPages, pagesPeriod]);
  const countries = useMemo(() => scaledCountries(data.topCountries, countriesPeriod), [data.topCountries, countriesPeriod]);
  const timelineData = useMemo(() => generateDailySessions(LP_BARS[timelinePeriod] === 7 ? 7 : timelinePeriod === "month" ? 30 : 365), [timelinePeriod]);

  return (
    <div className="space-y-6">
      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-emerald-900">Your Website</h3>
          </div>
          <p className="text-xs leading-relaxed text-emerald-800">
            We connect to <strong>Google Analytics 4</strong> via OAuth on websites you own. LLMs also use <strong>bot crawlers</strong> to index your content — we track those patterns to show you how AI models discover your site.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200/60 bg-gradient-to-br from-sky-50 to-indigo-50/60 p-5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100">
              <Globe className="h-4 w-4 text-sky-600" />
            </div>
            <h3 className="text-sm font-bold text-sky-900">Competitor Intelligence</h3>
          </div>
          <p className="text-xs leading-relaxed text-sky-800">
            For competitors we combine <strong>bot crawlers</strong>, <strong>third-party analytics APIs</strong>, <strong>backlink indexes</strong>, and <strong>web scraping</strong> to estimate traffic, top pages, and AI/LLM visibility — no GA4 access needed.
          </p>
        </div>
      </div>

      {/* Signal Sources */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Signal Sources</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Wikipedia — Active */}
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" alt="Wikipedia" width={20} height={20} className="rounded-sm shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700">Wikipedia</p>
              <p className="text-xs text-slate-400 truncate">Brand page views</p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
          </div>
          {/* Coming soon */}
          {[
            { domain: "newsapi.org", name: "NewsAPI", desc: "News articles & media coverage" },
            { domain: "reddit.com",  name: "Reddit",  desc: "Community discussions & trends" },
            { domain: "youtube.com", name: "YouTube", desc: "Video search & trending topics" },
          ].map((src) => (
            <div key={src.name} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 opacity-60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`} alt={src.name} width={20} height={20} className="rounded-sm shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">{src.name}</p>
                <p className="text-xs text-slate-400 truncate">{src.desc}</p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-400">Coming soon</span>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400 tracking-wide">{sectionDateLabel(kpiPeriod)}</p>
          <MiniPeriodToggle value={kpiPeriod} onChange={setKpiPeriod} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <KpiCard icon={<BarChart3 className="h-4 w-4 text-blue-500" />}    label="Sessions"    value={formatNumber(kpis.sessions)}    raw={kpis.sessions}    sparkKey="sessions"   trendKey="sessions"   period={kpiPeriod} />
          <KpiCard icon={<Users className="h-4 w-4 text-emerald-500" />}     label="Users"       value={formatNumber(kpis.users)}       raw={kpis.users}       sparkKey="users"      trendKey="users"      period={kpiPeriod} />
          <KpiCard icon={<Eye className="h-4 w-4 text-violet-500" />}        label="Pageviews"   value={formatNumber(kpis.pageviews)}   raw={kpis.pageviews}   sparkKey="pageviews"  trendKey="pageviews"  period={kpiPeriod} />
          <KpiCard icon={<TrendingUp className="h-4 w-4 text-amber-500" />}  label="Bounce Rate" value={`${kpis.bounceRate}%`}          raw={kpis.bounceRate}  sparkKey="bounceRate" trendKey="bounceRate" period={kpiPeriod} />
          <KpiCard icon={<Timer className="h-4 w-4 text-cyan-500" />}        label="Avg. Duration" value={formatDuration(kpis.avgEngagementSec)} raw={kpis.avgEngagementSec} sparkKey="avgTime" trendKey="avgTime" period={kpiPeriod} />
        </div>
      </div>

      {/* AI Traffic Spotlight */}
      <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-purple-50/40 to-indigo-50/20 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-violet-900">AI / LLM Traffic</h2>
              <p className="text-xs text-violet-500">{formatNumber(aiSessions)} sessions · this {aiPeriod}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums text-violet-900">{formatNumber(aiSessions)}</p>
              <p className="text-xs text-violet-400">AI-referred sessions</p>
            </div>
            <MiniPeriodToggle value={aiPeriod} onChange={setAiPeriod} />
          </div>
        </div>
        {aiBreakdown.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-3">
              {aiBreakdown.map((item, i) => (
                <div key={item.source}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", AI_SOURCE_COLORS[item.source] ?? "bg-violet-400")} />
                      <span className="font-medium text-slate-700">{item.source}</span>
                    </div>
                    <span className="text-xs text-slate-500">{formatNumber(item.sessions)} <span className="text-slate-300">·</span> {item.percentage}%</span>
                  </div>
                  <AnimatedBar pct={item.percentage} color={AI_SOURCE_COLORS[item.source] ?? "bg-violet-400"} delay={i * 80} />
                </div>
              ))}
            </div>
            <div className="lg:col-span-2 rounded-xl border border-violet-100 bg-white/70 p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">How we track this</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                We use <strong>GA4 referrer data</strong> to identify visits from ChatGPT, Perplexity, Gemini, and Claude.
              </p>
              <p className="mt-2 text-xs text-slate-400">GA4 captures ~20–30% of actual AI referrals — many LLM apps don't pass referrer headers.</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-violet-500">No AI/LLM referral traffic detected in this period.</p>
        )}
      </div>

      {/* Sessions Timeline */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Sessions Timeline</span>
          <MiniPeriodToggle value={timelinePeriod} onChange={setTimelinePeriod} />
        </div>
        <MiniChart
          data={timelineData}
          title="Sessions"
          subtitle={sectionDateShort(timelinePeriod)}
          totalValue={scaleNum(data.kpis.sessions, timelinePeriod)}
          totalLabel="sessions"
          unit=" sessions"
        />
      </div>

      {/* Traffic Sources + Top Pages */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Traffic Sources" subtitle={sectionDateShort(sourcesPeriod)} icon={<BarChart3 className="h-4 w-4" />} actions={<MiniPeriodToggle value={sourcesPeriod} onChange={setSourcesPeriod} />}>
          <TrafficSourcesDonut sources={sources} />
        </SectionCard>

        <SectionCard title="Top Pages" subtitle={sectionDateShort(pagesPeriod)} icon={<Eye className="h-4 w-4" />} actions={<MiniPeriodToggle value={pagesPeriod} onChange={setPagesPeriod} />}>
          <div className="space-y-1">
            {pages.map((page, i) => {
              const maxViews = Math.max(...pages.map((p) => p.pageviews));
              const barW = Math.round((page.pageviews / maxViews) * 100);
              return (
                <div key={page.path} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="w-4 text-xs font-bold text-slate-300">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{page.path}</p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${barW}%`, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-slate-700">{formatNumber(page.pageviews)}</p>
                    <p className="text-xs text-slate-400">{formatDuration(page.avgEngagementSec)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Top Countries */}
      <SectionCard title="Top Countries" subtitle={sectionDateShort(countriesPeriod)} icon={<Globe className="h-4 w-4" />} actions={<MiniPeriodToggle value={countriesPeriod} onChange={setCountriesPeriod} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            {countries.map((c, i) => (
              <div key={c.country}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{COUNTRY_FLAGS[c.country] ?? "🌍"}</span>
                    <span className="font-medium text-slate-700">{c.country}</span>
                  </div>
                  <span className="text-xs text-slate-400">{formatNumber(c.sessions)} · {c.percentage}%</span>
                </div>
                <AnimatedBar pct={c.percentage} color={`bg-[hsl(${(i * 52 + 150) % 360},60%,55%)]`} delay={i * 70} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-1.5 content-start">
            {countries.map((c, i) => (
              <div key={c.country} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-300">#{i + 1}</span>
                  <span className="text-sm">{COUNTRY_FLAGS[c.country] ?? "🌍"}</span>
                  <span className="text-sm font-medium text-slate-700">{c.country}</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-600">{formatNumber(c.sessions)}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

    </div>
  );
}


// ─── Tab content: AI Authority ─────────────────────────────────────────────

function AiAuthorityTab() {
  const [crawlerPeriod, setCrawlerPeriod] = useState<LP>("month");
  const [llmTrendPeriod, setLlmTrendPeriod] = useState<LP>("week");
  const [citedPagesPeriod, setCitedPagesPeriod] = useState<LP>("month");

  const crawlers = useMemo(() => scaledBotCrawlers(MOCK_BOT_CRAWLERS, crawlerPeriod), [crawlerPeriod]);
  const maxCrawls = useMemo(() => Math.max(...crawlers.map((b) => b.crawls)), [crawlers]);

  const chatgptBars    = useMemo(() => generateActivityBars(CHATGPT_BASE,   0.79, llmTrendPeriod), [llmTrendPeriod]);
  const perplexityBars = useMemo(() => generateActivityBars(PERPLEXITY_BASE, 0.82, llmTrendPeriod), [llmTrendPeriod]);
  const claudeBars     = useMemo(() => generateActivityBars(CLAUDE_BASE,    0.65, llmTrendPeriod), [llmTrendPeriod]);

  const citedPages = useMemo(() => MOCK_TOP_CITED_PAGES.map((p) => ({
    ...p, citations: scaleNum(p.citations, citedPagesPeriod),
  })), [citedPagesPeriod]);

  return (
    <div className="space-y-6">
      {/* Hero score */}
      <div className="rounded-2xl border border-violet-200/50 bg-gradient-to-br from-violet-50 via-purple-50/30 to-indigo-50/20 p-6">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">
            <Award className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-violet-900">AI Authority Score</h2>
            <p className="text-xs text-violet-500">Composite score across LLM traffic, citations, content quality &amp; crawl activity</p>
          </div>
          <span className="ml-auto rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Mock data</span>
        </div>
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <AuthorityGauge score={MOCK_AUTHORITY_SCORE} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ScorePill value={`${MOCK_CITATION_RATE}%`} label="Citation Rate" sublabel="of tracked prompts" color="bg-violet-100" icon={<MessageSquareQuote className="h-5 w-5 text-violet-600" />} />
            <ScorePill value={`${MOCK_GEO_SCORE}%`} label="GEO Content Score" sublabel="of articles pass GEO rules" color="bg-emerald-100" icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />} />
            <ScorePill value={`${MOCK_FRESHNESS_DAYS}d`} label="Content Freshness" sublabel="avg days since bot crawl" color="bg-blue-100" icon={<Clock className="h-5 w-5 text-blue-600" />} />
            <ScorePill value="14%" label="Share of AI Voice" sublabel="vs competitors" color="bg-amber-100" icon={<Radar className="h-5 w-5 text-amber-600" />} />
          </div>
        </div>
      </div>

      {/* Bot Crawlers + Voice Share */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Bot Crawler Activity" subtitle={sectionDateShort(crawlerPeriod)} icon={<Bot className="h-4 w-4" />} actions={<MiniPeriodToggle value={crawlerPeriod} onChange={setCrawlerPeriod} />}>
          <div className="space-y-3">
            {crawlers.map((bot, i) => (
              <div key={bot.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <BotLogo name={bot.name} size={18} />
                    <span className="font-medium text-slate-700">{bot.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{bot.lastSeen}</span>
                    <span className="font-semibold text-slate-600">{formatNumber(bot.crawls)}</span>
                  </div>
                </div>
                <AnimatedBar pct={Math.round((bot.crawls / maxCrawls) * 100)} color={bot.color} delay={i * 70} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400 border-t border-slate-100 pt-4">
            Bot crawl frequency is a proxy for <strong>LLM indexing interest</strong>.
          </p>
        </SectionCard>

        <SectionCard title="Share of AI Voice" icon={<Radar className="h-4 w-4" />}>
          <div className="space-y-3">
            {MOCK_VOICE_SHARE.map((item, i) => (
              <div key={item.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", item.color)} />
                    <span className={cn("font-medium", i === 0 ? "text-violet-700" : "text-slate-500")}>{item.name}</span>
                    {i === 0 && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700">You</span>}
                  </div>
                  <span className={cn("text-xs font-semibold", i === 0 ? "text-violet-700" : "text-slate-400")}>{item.pct}%</span>
                </div>
                <AnimatedBar pct={item.pct} color={item.color} delay={i * 60} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400 border-t border-slate-100 pt-4">
            Share of AI Voice measures how often your brand appears in LLM answers vs competitors.
          </p>
        </SectionCard>
      </div>

      {/* Top cited pages + Citation moments */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Top AI-Cited Pages" subtitle={sectionDateShort(citedPagesPeriod)} icon={<FileText className="h-4 w-4" />} actions={<MiniPeriodToggle value={citedPagesPeriod} onChange={setCitedPagesPeriod} />}>
          <div className="space-y-1">
            {citedPages.map((page, i) => {
              const max = Math.max(...citedPages.map((p) => p.citations));
              return (
                <div key={page.path} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="w-4 text-xs font-bold text-slate-300">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{page.path}</p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.round((page.citations / max) * 100)}%`, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-slate-700">{page.citations}</p>
                    <p className="text-xs text-emerald-600 font-medium">{page.trend} this {citedPagesPeriod}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-slate-400 border-t border-slate-100 pt-4">Citations = times this page was referenced in tracked LLM responses.</p>
        </SectionCard>

        <SectionCard title="Moments of Citation" icon={<MessageSquareQuote className="h-4 w-4" />}>
          <div className="space-y-3">
            {MOCK_CITATION_MOMENTS.map((m, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-sm font-medium text-slate-700 leading-snug">"{m.query}"</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">{m.model}</span>
                    <span className="truncate text-xs text-slate-400">{m.page}</span>
                  </div>
                  <span className="shrink-0 text-xs text-slate-300">{m.ago}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* LLM Traffic Trend */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              LLM Traffic — This {llmTrendPeriod} vs last {llmTrendPeriod}
            </h2>
          </div>
          <MiniPeriodToggle value={llmTrendPeriod} onChange={setLlmTrendPeriod} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <ActivityStatsCard title="ChatGPT"    icon={<BotLogo name="ChatGPT"    size={20} />} mainValue={`${scaleNum(98, llmTrendPeriod)} sessions`}  changeValue={21} changeDescription={LP_VS[llmTrendPeriod]} chartData={chatgptBars}    primaryBarClassName="bg-emerald-500" secondaryBarClassName="bg-emerald-100" />
          <ActivityStatsCard title="Perplexity" icon={<BotLogo name="Perplexity" size={20} />} mainValue={`${scaleNum(31, llmTrendPeriod)} sessions`}  changeValue={9}  changeDescription={LP_VS[llmTrendPeriod]} chartData={perplexityBars} primaryBarClassName="bg-blue-500"    secondaryBarClassName="bg-blue-100"    />
          <ActivityStatsCard title="Claude"     icon={<BotLogo name="Claude"     size={20} />} mainValue={`${scaleNum(8,  llmTrendPeriod)} sessions`}  changeValue={40} changeDescription={LP_VS[llmTrendPeriod]} chartData={claudeBars}    primaryBarClassName="bg-orange-400"  secondaryBarClassName="bg-orange-100"  />
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-bold text-slate-600">How AI Authority is calculated</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-slate-500 leading-relaxed">
          <div className="rounded-xl bg-white border border-slate-100 p-4">
            <p className="font-semibold text-slate-700 mb-1">LLM Traffic (30%)</p>
            <p>Direct referral visits from ChatGPT, Perplexity, Claude, and Gemini — measured via GA4 referrer data.</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-100 p-4">
            <p className="font-semibold text-slate-700 mb-1">Content Quality (40%)</p>
            <p>Percentage of articles passing GEO rules: definition openers, FAQ format, stats with sources, anchor phrases.</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-100 p-4">
            <p className="font-semibold text-slate-700 mb-1">Crawl &amp; Citations (30%)</p>
            <p>Bot crawler frequency combined with tracked citation moments across LLM responses.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<GlobalPeriod>("monthly");
  const [customRange, setCustomRange] = useState<DayPickerDateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("web");
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setOauthError(err);
  }, []);

  const activeDays = useMemo(() => {
    if (period === "custom" && customRange?.from && customRange?.to) {
      return Math.max(1, Math.round((customRange.to.getTime() - customRange.from.getTime()) / 86_400_000));
    }
    return GLOBAL_PERIOD_DAYS[period as Exclude<GlobalPeriod, "custom">] ?? 30;
  }, [period, customRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?days=${activeDays}`);
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [activeDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <Header />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            <button onClick={() => setTab("web")} className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all", tab === "web" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900")}>
              <BarChart3 className="h-3.5 w-3.5" />Web Analytics
            </button>
            <button disabled className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-not-allowed opacity-40 text-slate-600">
              <Award className="h-3.5 w-3.5" />AI Authority
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 leading-none">Q4</span>
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(["weekly", "monthly", "yearly"] as GlobalPeriod[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={cn("rounded-md px-3 py-1 text-xs font-semibold capitalize transition-all",
                    period === p ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900")}>
                  {p === "weekly" ? "Week" : p === "monthly" ? "Month" : "Year"}
                </button>
              ))}
            </div>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button onClick={() => { setPeriod("custom"); setCalendarOpen(true); }}
                  className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-all",
                    period === "custom" ? "border-slate-300 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900")}>
                  <CalendarIcon className="h-3 w-3" />
                  {period === "custom" && customRange?.from && customRange?.to
                    ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d")}`
                    : "Custom"}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="range" selected={customRange}
                  onSelect={(range) => { setCustomRange(range); if (range?.from && range?.to) setCalendarOpen(false); }}
                  numberOfMonths={2} disabled={{ after: new Date() }} defaultMonth={subDays(new Date(), 30)} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {oauthError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="flex-1">
              <strong>GA4 connection failed</strong> —{" "}
              {oauthError === "unauthenticated" && "You need to be logged in first. "}
              {oauthError === "no_ga4_property_found" && "No GA4 property found on this Google account. "}
              {oauthError === "token_exchange_failed" && "Google token exchange failed — try again. "}
              {oauthError === "missing_refresh_token" && "No refresh token returned — try connecting again. "}
              {!["unauthenticated","no_ga4_property_found","token_exchange_failed","missing_refresh_token"].includes(oauthError) && `Error: ${oauthError}. `}
            </p>
            <button onClick={() => setOauthError(null)} className="shrink-0 text-xs text-red-500 hover:text-red-700">Dismiss</button>
          </div>
        )}
        {data?.isMock && !loading && (
          <div className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Zap className="h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p><strong>Preview mode</strong> — sample data shown below.</p>
              <p className="text-xs text-amber-700 mt-0.5">Connect your Google Analytics 4 property for <strong>aitomarketgroup.com</strong> to see real traffic, AI referrals, and page data.</p>
            </div>
            <a
              href="/api/auth/google/ga4/start"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap"
            >
              Connect GA4 →
            </a>
          </div>
        )}
        {!data?.isMock && !loading && data?.connection?.connected && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            <p>
              <strong>Live data</strong> — connected to{" "}
              <strong>{data.connection.gaPropertyDisplayName ?? data.connection.gaPropertyId}</strong>
            </p>
          </div>
        )}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4">
            <OrganicLoader variant="breathing" size={64} withPhrases />
          </div>
        ) : !data ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm">Failed to load analytics data.</p>
            <Button variant="outline" size="sm" onClick={fetchData}>Retry</Button>
          </div>
        ) : tab === "web" ? (
          <WebAnalyticsTab data={data} />
        ) : (
          <AiAuthorityTab />
        )}
      </main>
    </div>
  );
}

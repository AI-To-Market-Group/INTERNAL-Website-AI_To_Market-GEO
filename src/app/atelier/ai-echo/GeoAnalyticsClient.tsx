"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  GeoBrandEntity,
  GeoCompetitorInput,
  GeoPromptResult,
  GeoRunMode,
  GeoRunResponse,
  GeoVariantRun,
  IdentityAnalysisResult,
} from "@/types";
import {
  Play,
  Loader2,
  FileText,
  BarChart3,
  Fingerprint,
  Link2,
  Building2,
  GitBranch,
  Clock,
  Percent,
  MessageSquare,
  TrendingUp,
  MapPin,
  Maximize2,
  Download,
  Upload,
  Users,
  DollarSign,
  PieChart,
  Target,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Database,
  Cloud,
  FileJson,
  History,
} from "lucide-react";
import { GeoHistoryPanel } from "./GeoHistoryPanel";

const GEO_VERTICALS = [
  "Technology",
  "Retail",
  "Health",
  "Finance",
  "Media",
  "Other",
] as const;

const LLM_OPTIONS = [
  {
    id: "gpt",
    label: "ChatGPT",
    sublabel: "GPT-4o mini search",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.843-3.372L15.115 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.403-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
    ),
    color: "emerald",
    disabled: false,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    sublabel: "Sonar",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10zm-10-7a7 7 0 1 0 0 14A7 7 0 0 0 12 5zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 12 7zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
      </svg>
    ),
    color: "blue",
    disabled: false,
  },
  {
    id: "claude",
    label: "Claude",
    sublabel: "Haiku",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M13.827 3.758L8.611 16.77l1.99.003 1.137-3.03h5.062l1.135 3.027h2.015L14.74 3.758h-.913zm-.428 3.24l1.965 5.168h-3.93l1.965-5.169zM5.085 3.758c-2.47 5.204-3.108 8.56-1.682 10.489.764 1.036 2.047 1.61 3.44 1.576.959-.023 1.875-.285 2.64-.779l-.759-1.546c-.544.342-1.158.534-1.805.55-.851.02-1.601-.327-2.06-.952-.838-1.135-.575-3.614 1.212-7.872l-1.002-.003.016-.463z"/>
      </svg>
    ),
    color: "orange",
    disabled: false,
  },
  {
    id: "gemini",
    label: "Gemini",
    sublabel: "Coming soon",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      </svg>
    ),
    color: "violet",
    disabled: true,
  },
] as const;

const CITATION_BRANCHES = [
  { id: "homepage", label: "Homepage / main site" },
  { id: "blog", label: "Blog" },
  { id: "other", label: "Other page" },
] as const;

function parsePrompts(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const GEO_RUN_TIMEOUT_MS = 5 * 60 * 1000;

async function runGeoAnalysis(params: {
  prompts: string[];
  mainUrl?: string;
  companyName?: string;
  brandEntities?: GeoBrandEntity[];
  vertical?: string;
  mode: GeoRunMode;
  runsPerPrompt?: number;
  variantsPerPrompt?: number;
  competitors?: GeoCompetitorInput[];
  useWebSearch?: boolean;
  targetLLMs?: string[];
}): Promise<GeoRunResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEO_RUN_TIMEOUT_MS);
  try {
    const res = await fetch("/api/geo/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    if (!res.ok) {
      let message = `GEO run failed (${res.status})`;
      try {
        const err = (await res.json()) as { error?: string };
        if (err?.error) message = err.error;
      } catch {
        try {
          const text = await res.text();
          if (text) message = text.slice(0, 200);
        } catch {
          /* empty */
        }
      }
      throw new Error(message);
    }
    return (await res.json()) as GeoRunResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

function exportResultsCsv(results: GeoPromptResult[], totalCost?: number) {
  const header = [
    "Prompt",
    "Cited",
    "Citation Rate %",
    "Runs",
    "Cited Count",
    "Position",
    "Sources",
    "Share of Voice",
    "Confidence (1-5)",
    "Latency (s)",
    "Tokens",
    "Cost (USD)",
    "Sources Found",
    "Competitors Cited",
  ].join(",");
  const rows = results.map((r) => {
    const competitorsCited = (r.competitorResults ?? [])
      .filter((c) => c.cited)
      .map((c) => c.name)
      .join("; ");
    return [
      `"${r.prompt.replace(/"/g, '""')}"`,
      r.cited ? "Yes" : "No",
      r.avgCitationRate ?? 0,
      r.runs ?? 1,
      r.citedCount ?? 0,
      r.answerPosition ?? "—",
      r.sourceCount ?? 0,
      r.shareOfVoice != null ? `${Math.round(r.shareOfVoice * 100)}%` : "—",
      r.confidenceScore ?? 0,
      r.latencyMs != null ? (r.latencyMs / 1000).toFixed(1) : "—",
      r.inputTokens != null && r.outputTokens != null
        ? r.inputTokens + r.outputTokens
        : "—",
      r.estimatedCostUsd != null ? `$${r.estimatedCostUsd.toFixed(4)}` : "—",
      `"${(r.sourcesFound ?? []).join("; ")}"`,
      `"${competitorsCited}"`,
    ].join(",");
  });
  if (totalCost != null) {
    rows.push(`"TOTAL",,,,,,,,,,,"$${totalCost.toFixed(4)}","",""`);
  }
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `geo-results-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportResultsJson(response: GeoRunResponse) {
  const json = JSON.stringify(response, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `geo-results-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

type GeoTab = "ranking" | "identity" | "history";

// @ts-ignore -- dummy data constants below are intentionally unreferenced (UI dev scaffolding)
const _DUMMY_VARIANT = (prompt: string, cited: boolean, pos: "top_1" | "top_5" | "top_10" | "top_25" | "top_33" | "top_50" | "top_66" | "top_75", conf: number, sources: string[], compCited: boolean): GeoVariantRun => ({
  prompt,
  snippet: cited
    ? `For marathon running, top picks include the Nike Vaporfly 3 (nike.com), Adidas Adizero Adios Pro 4 (adidas.com), and ASICS Metaspeed Sky+ (asics.com). The Nike Vaporfly remains the gold standard for carbon-plated race shoes, while Adidas offers…`
    : `When training for a marathon, focus on building your weekly mileage gradually, incorporate tempo runs and long runs, and pay attention to nutrition and recovery. Many coaches recommend the Daniels Running Formula for structured plans…`,
  fullResponse: cited
    ? `For marathon running, the top choices in 2026 include:\n\n1. **Nike Vaporfly 3** (nike.com) — Widely regarded as the industry leader in carbon-plated marathon shoes. Features ZoomX foam and a full-length carbon plate.\n\n2. **Adidas Adizero Adios Pro 4** (adidas.com) — A strong competitor with Lightstrike Pro cushioning and carbon Energy Rods.\n\n3. **ASICS Metaspeed Sky+** (asics.com) — Designed for stride-type runners with FF Turbo foam.\n\n4. **New Balance SC Elite v4** (newbalance.com) — FuelCell foam with a carbon plate, a popular choice.\n\n5. **Saucony Endorphin Elite** (saucony.com) — PWRRUN HG super-foam, competitive with the Vaporfly.\n\nFor most marathon runners, the Nike Vaporfly 3 is the go-to recommendation due to its proven race-day performance.`
    : `Training for a marathon requires a well-structured plan that builds endurance gradually over 16-20 weeks. Key components include:\n\n1. **Base building** — Start with 25-30 miles per week\n2. **Long runs** — Weekly long runs increasing to 20-22 miles\n3. **Tempo runs** — At marathon pace to build lactate threshold\n4. **Recovery** — Rest days and easy runs are crucial\n\nMost running coaches recommend following the Daniels Running Formula or Pfitzinger plans. Nutrition should focus on carbohydrate loading before race day.`,
  cited,
  citationLevel: cited ? "site" : "none",
  positionRank: cited ? 1 : null,
  answerPosition: cited ? pos : null,
  sourcesFound: sources,
  competitorResults: [
    {
      name: "Example Competitor 1",
      url: "https://competitor1.example.com",
      cited: compCited,
      citationLevel: compCited ? "brand" : "none",
    },
    {
      name: "Example Competitor 2",
      url: "https://competitor2.example.com",
      cited: false,
      citationLevel: "none",
    },
  ],
  confidenceScore: conf,
});

const _DUMMY_RESULTS: GeoPromptResult[] = [
  {
    prompt: "What is the best AI consultancy for B2B marketing teams?",
    citationRateByLLM: { gpt: 60 },
    avgCitationRate: 60,
    rank: 1,
    lastRun: new Date().toISOString(),
    cited: true,
    latencyMs: 4820,
    inputTokens: 1250,
    outputTokens: 3400,
    runs: 5,
    citedCount: 3,
    mode: "repeat",
    estimatedCostUsd: 0.0022,
    answerPosition: "top_25",
    sourceCount: 6,
    shareOfVoice: 0.167,
    sourcesFound: [
      "example.com",
      "competitor1.example.com",
      "competitor2.example.com",
      "competitor3.example.com",
      "competitor4.example.com",
      "competitor5.example.com",
    ],
    competitorResults: [
      {
        name: "Example Competitor 1",
        url: "https://competitor1.example.com",
        cited: true,
        citationLevel: "site",
      },
      {
        name: "Example Competitor 2",
        url: "https://competitor2.example.com",
        cited: true,
        citationLevel: "brand",
      },
    ],
    confidenceScore: 5,
    variantRuns: [
      _DUMMY_VARIANT(
        "Run 1",
        true,
        "top_25",
        5,
        ["example.com", "competitor1.example.com", "competitor3.example.com"],
        true
      ),
      _DUMMY_VARIANT(
        "Run 2",
        true,
        "top_25",
        5,
        ["example.com", "competitor2.example.com", "competitor4.example.com"],
        false
      ),
      _DUMMY_VARIANT(
        "Run 3",
        false,
        "top_75",
        0,
        ["competitor1.example.com", "competitor3.example.com", "competitor5.example.com"],
        true
      ),
      _DUMMY_VARIANT(
        "Run 4",
        true,
        "top_50",
        3,
        ["example.com", "competitor2.example.com", "competitor4.example.com"],
        true
      ),
      _DUMMY_VARIANT(
        "Run 5",
        false,
        "top_75",
        0,
        ["competitor4.example.com", "competitor5.example.com"],
        false
      ),
    ],
  },
  {
    prompt: "Best VR product to buy in 2026",
    citationRateByLLM: { gpt: 40 },
    avgCitationRate: 40,
    rank: 2,
    lastRun: new Date().toISOString(),
    cited: true,
    latencyMs: 3910,
    inputTokens: 1100,
    outputTokens: 2800,
    runs: 5,
    citedCount: 2,
    mode: "repeat",
    estimatedCostUsd: 0.0019,
    answerPosition: "top_50",
    sourceCount: 4,
    shareOfVoice: 0.25,
    sourcesFound: ["example.com", "competitor1.example.com", "competitor3.example.com", "competitor4.example.com"],
    competitorResults: [
      {
        name: "Example Competitor 1",
        url: "https://competitor1.example.com",
        cited: false,
        citationLevel: "none",
      },
      {
        name: "Example Competitor 2",
        url: "https://competitor2.example.com",
        cited: false,
        citationLevel: "none",
      },
    ],
    confidenceScore: 3,
    variantRuns: [
      _DUMMY_VARIANT(
        "Run 1",
        true,
        "top_50",
        3,
        ["example.com", "competitor1.example.com", "competitor3.example.com"],
        false
      ),
      _DUMMY_VARIANT(
        "Run 2",
        false,
        "top_75",
        0,
        ["competitor3.example.com", "competitor4.example.com"],
        false
      ),
      _DUMMY_VARIANT(
        "Run 3",
        false,
        "top_75",
        0,
        ["competitor1.example.com", "competitor4.example.com"],
        false
      ),
      _DUMMY_VARIANT(
        "Run 4",
        true,
        "top_25",
        5,
        ["example.com", "competitor4.example.com"],
        false
      ),
      _DUMMY_VARIANT(
        "Run 5",
        false,
        "top_75",
        0,
        ["competitor1.example.com", "competitor3.example.com", "competitor4.example.com"],
        false
      ),
    ],
  },
  {
    prompt: "Best company in retail",
    citationRateByLLM: { gpt: 80 },
    avgCitationRate: 80,
    rank: 3,
    lastRun: new Date().toISOString(),
    cited: true,
    latencyMs: 5200,
    inputTokens: 1300,
    outputTokens: 3700,
    runs: 5,
    citedCount: 4,
    mode: "repeat",
    estimatedCostUsd: 0.0024,
    answerPosition: "top_25",
    sourceCount: 5,
    shareOfVoice: 0.2,
    sourcesFound: [
      "example.com",
      "competitor1.example.com",
      "competitor2.example.com",
      "competitor3.example.com",
      "competitor4.example.com",
    ],
    competitorResults: [
      {
        name: "Example Competitor 1",
        url: "https://competitor1.example.com",
        cited: true,
        citationLevel: "site",
      },
      {
        name: "Example Competitor 2",
        url: "https://competitor2.example.com",
        cited: true,
        citationLevel: "brand",
      },
    ],
    confidenceScore: 5,
    variantRuns: [
      _DUMMY_VARIANT(
        "Run 1",
        true,
        "top_25",
        5,
        ["example.com", "competitor1.example.com", "competitor2.example.com"],
        true
      ),
      _DUMMY_VARIANT(
        "Run 2",
        true,
        "top_25",
        5,
        ["example.com", "competitor3.example.com", "competitor4.example.com"],
        true
      ),
      _DUMMY_VARIANT(
        "Run 3",
        true,
        "top_50",
        3,
        ["example.com", "competitor1.example.com", "competitor3.example.com"],
        true
      ),
      _DUMMY_VARIANT(
        "Run 4",
        true,
        "top_25",
        5,
        ["example.com", "competitor2.example.com"],
        false
      ),
      _DUMMY_VARIANT(
        "Run 5",
        false,
        "top_75",
        0,
        ["competitor1.example.com", "competitor4.example.com", "competitor5.example.com"],
        true
      ),
    ],
  },
  {
    prompt: "Best tool to spend ads on?",
    citationRateByLLM: { gpt: 50 },
    avgCitationRate: 50,
    rank: 4,
    lastRun: new Date().toISOString(),
    cited: true,
    latencyMs: 4500,
    inputTokens: 1200,
    outputTokens: 3200,
    runs: 5,
    citedCount: 2,
    mode: "repeat",
    estimatedCostUsd: 0.002,
    answerPosition: "top_50",
    sourceCount: 3,
    shareOfVoice: 0.15,
    sourcesFound: ["example.com", "competitor4.example.com", "competitor5.example.com"],
    competitorResults: [
      {
        name: "Example Competitor 1",
        url: "https://competitor1.example.com",
        cited: true,
        citationLevel: "site",
      },
      {
        name: "Example Competitor 2",
        url: "https://competitor2.example.com",
        cited: false,
        citationLevel: "none",
      },
    ],
    confidenceScore: 4,
    variantRuns: [
      _DUMMY_VARIANT(
        "Run 1",
        true,
        "top_50",
        4,
        ["example.com", "competitor4.example.com"],
        true
      ),
      _DUMMY_VARIANT(
        "Run 2",
        false,
        "top_75",
        0,
        ["competitor5.example.com"],
        false
      ),
      _DUMMY_VARIANT(
        "Run 3",
        true,
        "top_25",
        5,
        ["example.com", "competitor5.example.com"],
        true
      ),
      _DUMMY_VARIANT(
        "Run 4",
        false,
        "top_75",
        0,
        ["competitor4.example.com"],
        false
      ),
      _DUMMY_VARIANT(
        "Run 5",
        false,
        "top_75",
        0,
        ["competitor4.example.com", "competitor5.example.com"],
        false
      ),
    ],
  },
];

const _DUMMY_RUN_RESPONSE: GeoRunResponse = {
  results: _DUMMY_RESULTS,
  runId: "geo-dummy-1708300000000",
  totalLatencyMs: 13930,
  totalInputTokens: 3650,
  totalOutputTokens: 9900,
  totalEstimatedCostUsd: 0.0065,
  model: "gpt-4o-mini-search-preview",
};
// ── End dummy data ─────────────────────────────────────────────────────
/* eslint-enable @typescript-eslint/no-unused-vars */

export function GeoAnalyticsClient() {
  const [activeTab, setActiveTab] = useState<GeoTab>("ranking");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Echo Ranking state
  const [promptsText, setPromptsText] = useState(
    "best AI consultancy for B2B companies 2025\nhow to implement AI in a marketing team\nwhat is generative engine optimization (GEO)?\nAI tools for B2B sales prospecting\nhow AI improves supply chain forecasting\nbest AI marketing automation platforms compared\nwhat does an AI strategy consultant do?\nAI agents for sales and marketing use cases\nhow to measure AI ROI in B2B marketing\ngenerative AI for enterprise sales teams"
  );
  const [selectedVertical, setSelectedVertical] = useState<string>(
    GEO_VERTICALS[0]
  );
  const [mainUrl, setMainUrl] = useState("https://www.aitomarketgroup.com");
  const [companyName, setCompanyName] = useState("AI To Market");
  const [brandEntitiesText, setBrandEntitiesText] = useState(
    "AI To Market | main\nAI To Market | brand"
  );
  const [citationBranch, setCitationBranch] = useState<string>("homepage");
  const [geoMode, setGeoMode] = useState<GeoRunMode>("repeat");
  const [runsPerPrompt, setRunsPerPrompt] = useState(3);
  const [variantsPerPrompt, setVariantsPerPrompt] = useState(3);
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [selectedLLMs, setSelectedLLMs] = useState<string[]>(["gpt"]);

  const toggleLLM = useCallback((id: string) => {
    if (id === "gemini") return;
    setSelectedLLMs((prev) =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter((l) => l !== id) : prev
        : [...prev, id]
    );
  }, []);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<GeoPromptResult[]>([]);
  const [lastRunResponse, setLastRunResponse] = useState<GeoRunResponse | null>(null);
  const [lastRunError, setLastRunError] = useState<string | null>(null);

  // Competitors
  const [competitorsText, setCompetitorsText] = useState(
    "McKinsey & Company, https://www.mckinsey.com\nAccenture, https://www.accenture.com\nDeloitte Digital, https://www.deloittedigital.com\nGartner, https://www.gartner.com"
  );

  // Identity Analysis state
  const [identityUrl, setIdentityUrl] = useState("");
  const [identityCompanyName, setIdentityCompanyName] = useState("");
  const [identityKeyMessages, setIdentityKeyMessages] = useState("");
  const [identityRunning, setIdentityRunning] = useState(false);
  const [identityResult, setIdentityResult] =
    useState<IdentityAnalysisResult | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [geoFullResponseOpen, setGeoFullResponseOpen] = useState<{
    rowIndex: number;
    variantIndex: number;
  } | null>(null);
  const [identityFullResponseOpen, setIdentityFullResponseOpen] = useState<
    number | null
  >(null);
  // Per-prompt carousel index for variant/repeat runs
  const [runCarouselIndex, setRunCarouselIndex] = useState<Record<number, number>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const prompts = useMemo(() => parsePrompts(promptsText), [promptsText]);
  const competitors: GeoCompetitorInput[] = useMemo(() => {
    return competitorsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",").map((s) => s.trim());
        return { name: parts[0], url: parts[1] || undefined };
      });
  }, [competitorsText]);

  const brandEntities: GeoBrandEntity[] = useMemo(() => {
    return brandEntitiesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map<GeoBrandEntity>((line) => {
        const pipe = line.indexOf("|");
        const name = pipe >= 0 ? line.slice(0, pipe).trim() : line;
        const typeStr = pipe >= 0 ? line.slice(pipe + 1).trim().toLowerCase() : "brand";
        const type: GeoBrandEntity["type"] =
          typeStr === "main" || typeStr === "sub_entity" ? typeStr : "brand";
        return { name: name || line, type };
      })
      .filter((e) => e.name);
  }, [brandEntitiesText]);

  // CSV import handler
  const handleCsvImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.replace(/^"|"$/g, "").trim())
          .filter(Boolean);
        if (lines.length > 0) {
          setPromptsText((prev) =>
            prev.trim() ? prev + "\n" + lines.join("\n") : lines.join("\n")
          );
          toast.success(`Imported ${lines.length} prompt(s) from CSV.`);
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    []
  );

  const handleRun = useCallback(async () => {
    if (prompts.length === 0) {
      toast.error("Add at least one prompt (one per line).");
      return;
    }
    setIsRunning(true);
    setLastRunError(null);
    const llmLabels = selectedLLMs.map((id) => LLM_OPTIONS.find((l) => l.id === id)?.label ?? id).join(", ");
    toast.info(`Running GEO analysis on ${llmLabels}…`);
    try {
      const resp = await runGeoAnalysis({
        prompts,
        mainUrl: mainUrl.trim() || undefined,
        companyName: companyName.trim() || undefined,
        brandEntities: brandEntities.length > 0 ? brandEntities : undefined,
        vertical: selectedVertical || undefined,
        mode: geoMode,
        runsPerPrompt:
          geoMode === "repeat"
            ? Math.min(10, Math.max(1, runsPerPrompt))
            : undefined,
        variantsPerPrompt:
          geoMode === "variants"
            ? Math.min(5, Math.max(1, variantsPerPrompt))
            : undefined,
        competitors: competitors.length > 0 ? competitors : undefined,
        useWebSearch,
        targetLLMs: selectedLLMs.filter((id) => id !== "gemini") as import("@/types").GeoLLMId[],
      });
      setResults(resp.results);
      setRunCarouselIndex({});
      setLastRunResponse(resp);
      const citedCount = resp.results.filter((r) => r.cited).length;
      const totalRuns = resp.results.reduce((a, r) => a + (r.runs ?? 1), 0);
      const costStr = resp.totalEstimatedCostUsd != null
        ? ` Cost: $${resp.totalEstimatedCostUsd.toFixed(4)}.`
        : "";
      toast.success(
        `Done: ${resp.results.length} prompt(s), ${totalRuns} run(s). ${citedCount} cited.${costStr}`
      );
    } catch (e) {
      const message =
        e instanceof Error && e.name === "AbortError"
          ? "GEO run timed out (5 min). Try fewer prompts or fewer runs per prompt."
          : e instanceof Error
            ? e.message
            : "GEO run failed.";
      setLastRunError(message);
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  }, [
    prompts,
    mainUrl,
    companyName,
    selectedVertical,
    geoMode,
    runsPerPrompt,
    variantsPerPrompt,
    competitors,
    useWebSearch,
    selectedLLMs,
  ]);

  const handleRunIdentity = useCallback(async () => {
    if (!identityUrl.trim()) {
      toast.error("Enter a URL to analyze.");
      return;
    }
    setIdentityRunning(true);
    setIdentityResult(null);
    setIdentityError(null);
    toast.info("Running identity analysis (several queries to the model)…");
    try {
      const keyMessages = identityKeyMessages
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/identity/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: identityUrl.trim(),
          companyName: identityCompanyName.trim() || undefined,
          keyMessages: keyMessages.length > 0 ? keyMessages : undefined,
        }),
      });
      if (!res.ok) {
        let msg = `Identity analysis failed (${res.status})`;
        try {
          const err = (await res.json()) as { error?: string };
          if (err?.error) msg = err.error;
        } catch {
          /* empty */
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as IdentityAnalysisResult;
      setIdentityResult(data);
      toast.success("Identity analysis complete.");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Identity analysis failed.";
      setIdentityError(message);
      toast.error(message);
    } finally {
      setIdentityRunning(false);
    }
  }, [identityUrl, identityCompanyName, identityKeyMessages]);

  const positionLabel = (p: string | null | undefined) => {
    if (!p) return "—";
    const labels: Record<string, string> = {
      top_1: "Top: 1%",
      top_5: "Top: 5%",
      top_10: "Top: 10%",
      top_25: "Top: 25%",
      top_33: "Top: 33%",
      top_50: "Top: 50%",
      top_66: "Top: 66%",
      top_75: "Top: 75%",
    };
    return labels[p] ?? p.replace(/_/g, " ");
  };

  /** Recommendation strength (1–5): Strong/Medium = endorsement language; Mention = cited but no endorsement. */
  const confidenceLabel = (score: number | undefined) => {
    if (!score) return "—";
    if (score >= 5) return "Strong";
    if (score >= 3) return "Medium";
    if (score >= 1) return "Mention";
    return "—";
  };

  const confidenceColor = (score: number | undefined) => {
    if (!score) return "";
    if (score >= 5) return "bg-emerald-100 text-emerald-800";
    if (score >= 3) return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Generative Engine Optimization Analytics
        </h1>
        <p className="mt-1 text-muted-foreground">
          Rank your prompts across AI search engines, or analyze your online
          identity. Choose a service below.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("ranking")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "ranking"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <BarChart3 className="h-4 w-4" />
          AI Echo Ranking
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("identity")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "identity"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Fingerprint className="h-4 w-4" />
          Identity Analysis
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "history"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <History className="h-4 w-4" />
          History
        </button>
      </div>

      {activeTab === "ranking" && (
        <>
          {/* LLM selector */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Target AI models</CardTitle>
              <CardDescription>
                Select which AI engines to benchmark your visibility against.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {LLM_OPTIONS.map((llm) => {
                  const active = selectedLLMs.includes(llm.id);
                  const colorMap: Record<string, { ring: string; bg: string; text: string; dot: string }> = {
                    emerald: { ring: "border-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
                    blue:    { ring: "border-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30",       text: "text-blue-700 dark:text-blue-300",       dot: "bg-blue-500"    },
                    orange:  { ring: "border-orange-400",  bg: "bg-orange-50 dark:bg-orange-950/30",   text: "text-orange-700 dark:text-orange-300",   dot: "bg-orange-500"  },
                    violet:  { ring: "border-violet-300",  bg: "bg-violet-50/60 dark:bg-violet-950/20", text: "text-violet-400 dark:text-violet-500",  dot: "bg-violet-300"  },
                  };
                  const c = colorMap[llm.color];
                  return (
                    <button
                      key={llm.id}
                      type="button"
                      onClick={() => toggleLLM(llm.id)}
                      disabled={llm.disabled}
                      className={cn(
                        "relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all duration-150 text-center",
                        llm.disabled
                          ? "cursor-not-allowed opacity-50 border-border bg-muted/20"
                          : active
                            ? cn("shadow-sm", c.ring, c.bg)
                            : "border-border bg-card hover:bg-muted/30 hover:border-muted-foreground/30"
                      )}
                    >
                      {/* Active dot */}
                      {active && !llm.disabled && (
                        <span className={cn("absolute top-2.5 right-2.5 h-2 w-2 rounded-full", c.dot)} />
                      )}
                      {/* Icon */}
                      <div className={cn("transition-colors", active && !llm.disabled ? c.text : "text-muted-foreground")}>
                        {llm.icon}
                      </div>
                      {/* Labels */}
                      <div>
                        <p className={cn("text-sm font-semibold leading-none", active && !llm.disabled ? c.text : "text-foreground")}>
                          {llm.label}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-none">{llm.sublabel}</p>
                      </div>
                      {llm.disabled && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 pointer-events-none">Soon</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedLLMs.length > 1 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Queries will run against {selectedLLMs.length} models in parallel — cost and latency multiply accordingly.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Verticals */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Vertical</CardTitle>
              <CardDescription>
                Industry or vertical for context when evaluating citations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {GEO_VERTICALS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVertical(v)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      selectedVertical === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Citation target */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Citation target
              </CardTitle>
              <CardDescription>
                Main URL and company name to check for citation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Main URL</label>
                <Input
                  value={mainUrl}
                  onChange={(e) => setMainUrl(e.target.value)}
                  placeholder="https://www.example.com"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4" />
                  Company name
                </label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company or brand name"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4" />
                  Brand entities (LLM judge)
                </label>
                <p className="text-xs text-muted-foreground">
                  One per line: <code>Name | main</code>, <code>brand</code>, or <code>sub_entity</code>. Used for smart citation detection (e.g. AI To Market | main). Leave empty to use only company name above.
                </p>
                <textarea
                  value={brandEntitiesText}
                  onChange={(e) => setBrandEntitiesText(e.target.value)}
                  placeholder={"AI To Market | main\nAI To Market | brand"}
                  rows={4}
                  className={cn(
                    "border-input bg-background placeholder:text-muted-foreground",
                    "w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "resize-y min-h-[80px]"
                  )}
                />
                {brandEntities.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {brandEntities.length} entit{brandEntities.length === 1 ? "y" : "ies"} (citation judge enabled)
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <GitBranch className="h-4 w-4" />
                  Branch / context
                </label>
                <div className="flex flex-wrap gap-2">
                  {CITATION_BRANCHES.map(({ id, label }) => (
                    <label
                      key={id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        citationBranch === id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      <input
                        type="radio"
                        name="citationBranch"
                        value={id}
                        checked={citationBranch === id}
                        onChange={() => setCitationBranch(id)}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Competitors */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Competitors (optional)
              </CardTitle>
              <CardDescription>
                One competitor per line. Format: <code>Name</code> or{" "}
                <code>Name, https://url.com</code>. We check if they are cited
                alongside you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={competitorsText}
                onChange={(e) => setCompetitorsText(e.target.value)}
                placeholder={"Pricer, https://www.pricer.com\nSoluM\nHanshow"}
                rows={3}
                className={cn(
                  "border-input bg-background placeholder:text-muted-foreground",
                  "w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  "resize-y min-h-[80px]"
                )}
              />
              {competitors.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {competitors.length} competitor
                  {competitors.length !== 1 ? "s" : ""} parsed
                </p>
              )}
            </CardContent>
          </Card>

          {/* Prompts + CSV import */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Prompts to rank
              </CardTitle>
              <CardDescription>
                Write one prompt per line, or import from a CSV/TXT file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={promptsText}
                onChange={(e) => setPromptsText(e.target.value)}
                placeholder="e.g. What are the best running shoes for marathons?&#10;How to optimize content for AI search?"
                rows={6}
                className={cn(
                  "border-input bg-background placeholder:text-muted-foreground",
                  "w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  "resize-y min-h-[120px]"
                )}
              />
              <div className="flex items-center gap-4">
                <p className="text-xs text-muted-foreground">
                  {prompts.length} prompt{prompts.length !== 1 ? "s" : ""}{" "}
                  parsed
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvImport}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV / TXT
                </Button>
              </div>
              <div className="space-y-4 pt-4 border-t border-border">
                <p className="text-sm font-medium">Model</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={useWebSearch ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseWebSearch(true)}
                    className="gap-1.5"
                  >
                    <Database className="h-3.5 w-3.5" />
                    Search
                  </Button>
                  <Button
                    type="button"
                    variant={!useWebSearch ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseWebSearch(false)}
                    className="gap-1.5"
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    Knowledge
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {useWebSearch
                    ? "Uses web search (live results). Higher cost per run."
                    : "Uses model knowledge only (no web search). Cheaper."}
                </p>
              </div>
              <div className="space-y-4 pt-4 border-t border-border">
                <p className="text-sm font-medium">Bench mode</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      geoMode === "repeat"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <input
                      type="radio"
                      name="geoMode"
                      checked={geoMode === "repeat"}
                      onChange={() => setGeoMode("repeat")}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-medium">
                        Repeat each prompt N times
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Run the same question N times to get a citation rate %
                        per prompt.
                      </p>
                      {geoMode === "repeat" && (
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={runsPerPrompt}
                            onChange={(e) =>
                              setRunsPerPrompt(
                                Math.min(
                                  10,
                                  Math.max(
                                    1,
                                    parseInt(e.target.value, 10) || 1
                                  )
                                )
                              )
                            }
                            className="w-20 h-8 text-center"
                          />
                          <span className="text-xs">runs per prompt (max 10)</span>
                        </div>
                      )}
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      geoMode === "variants"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <input
                      type="radio"
                      name="geoMode"
                      checked={geoMode === "variants"}
                      onChange={() => setGeoMode("variants")}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-medium">
                        Generate X similar prompts per prompt
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        For each prompt, generate X nearest phrasings, then run
                        each once.
                      </p>
                      {geoMode === "variants" && (
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={variantsPerPrompt}
                            onChange={(e) =>
                              setVariantsPerPrompt(
                                Math.min(
                                  5,
                                  Math.max(
                                    1,
                                    parseInt(e.target.value, 10) || 1
                                  )
                                )
                              )
                            }
                            className="w-20 h-8 text-center"
                          />
                          <span className="text-xs">
                            similar prompts to generate (max 5)
                          </span>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Run button */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {useWebSearch
                ? "Search model: each prompt × run incurs web search fees. Use Knowledge mode for cheaper runs."
                : "Knowledge model: no web search fees. Lower cost per run."}
            </p>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleRun}
                disabled={isRunning || prompts.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run AI Echo analysis
                  </>
                )}
              </Button>
              {results.length > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    Last run: {results.length} prompt(s)
                    {results[0]?.mode === "repeat" && results[0]?.runs
                      ? `, ${results[0].runs} runs each`
                      : results[0]?.mode === "variants" && results[0]?.runs
                        ? `, ${results[0].runs} variants each`
                        : ""}
                  </span>
                  <div className="relative" ref={exportRef}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExportOpen((v) => !v)}
                      onBlur={(e) => {
                        if (!exportRef.current?.contains(e.relatedTarget as Node)) {
                          setExportOpen(false);
                        }
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", exportOpen && "rotate-180")} />
                    </Button>
                    {exportOpen && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border border-border bg-popover py-1 shadow-md animate-in fade-in-0 zoom-in-95">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                          onMouseDown={() => {
                            exportResultsCsv(results, lastRunResponse?.totalEstimatedCostUsd);
                            setExportOpen(false);
                          }}
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Export as CSV
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                          onMouseDown={() => {
                            if (lastRunResponse) exportResultsJson(lastRunResponse);
                            setExportOpen(false);
                          }}
                        >
                          <FileJson className="h-4 w-4 text-muted-foreground" />
                          Export as JSON
                        </button>
                        <div className="my-1 border-t border-border" />
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
                          onMouseDown={() => {
                            toast.info("Snowflake export coming soon.");
                            setExportOpen(false);
                          }}
                        >
                          <Database className="h-4 w-4" />
                          To Snowflake
                          <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">Soon</Badge>
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
                          onMouseDown={() => {
                            toast.info("AWS export coming soon.");
                            setExportOpen(false);
                          }}
                        >
                          <Cloud className="h-4 w-4" />
                          To AWS
                          <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">Soon</Badge>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {isRunning && (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                This can take 1–2 min (e.g. 5 prompts × 5 variants = 30 API
                calls). For a quick test, use 1 prompt and 2 runs/variants.
              </p>
            )}
          </div>

          {/* Run-level summary KPIs */}
          {lastRunResponse && results.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Overall Citation Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {Math.round(
                      results.reduce((a, r) => a + (r.avgCitationRate ?? 0), 0) /
                        results.length
                    )}
                    %
                  </p>
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
                  <p className="text-2xl font-semibold">
                    {Math.round(
                      (results.reduce(
                        (a, r) => a + (r.shareOfVoice ?? 0),
                        0
                      ) /
                        results.length) *
                        100
                    )}
                    %
                  </p>
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
                  <p className="text-2xl font-semibold">
                    {((lastRunResponse.totalLatencyMs ?? 0) / 1000).toFixed(1)}s
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
                  <p className="text-2xl font-semibold">
                    $
                    {(lastRunResponse.totalEstimatedCostUsd ?? 0).toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(lastRunResponse.totalInputTokens ?? 0) +
                      (lastRunResponse.totalOutputTokens ?? 0)}{" "}
                    tokens
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Results */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                AI Echo Results
              </CardTitle>
              <CardDescription>
                {results.length > 0
                  ? "One card per prompt with all metrics."
                  : 'Run the analysis above to see results here.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="space-y-4">
                  {lastRunError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                      <strong>Last run failed:</strong> {lastRunError}
                    </div>
                  )}
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
                    <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium text-foreground">
                      No results yet
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lastRunError
                        ? "Fix the error above and run again."
                        : 'Click "Run AI Echo analysis" above.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {results.map((row, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border bg-card p-4 space-y-4"
                    >
                      {/* Prompt */}
                      <p className="font-medium text-foreground text-sm leading-snug">
                        {row.prompt}
                      </p>
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
                          ) : (
                            "—"
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Citation Rate</p>
                          <span className="font-medium">{row.avgCitationRate ?? 0}%</span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Position</p>
                          <span className="capitalize">{positionLabel(row.answerPosition)}</span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Sources / SoV</p>
                          <span>
                            {row.sourceCount ?? 0} sources
                            {row.shareOfVoice != null && row.shareOfVoice > 0
                              ? ` · ${Math.round(row.shareOfVoice * 100)}% SoV`
                              : ""}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5" title="Recommendation strength (1-5): Strong/Medium = endorsement; Mention = cited only">Confidence</p>
                          <Badge className={confidenceColor(row.confidenceScore)} title="Recommendation strength: Strong/Medium = endorsement language; Mention = cited only">
                            {confidenceLabel(row.confidenceScore)}
                            {row.confidenceScore ? ` (${row.confidenceScore}/5)` : ""}
                          </Badge>
                        </div>
                      </div>
                      {/* Secondary metrics */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Latency:{" "}
                          {row.latencyMs != null
                            ? `${(row.latencyMs / 1000).toFixed(1)}s`
                            : "—"}
                        </span>
                        <span>
                          Tokens:{" "}
                          {row.inputTokens != null && row.outputTokens != null
                            ? `${row.inputTokens + row.outputTokens}`
                            : "—"}
                        </span>
                        <span>
                          Cost:{" "}
                          {row.estimatedCostUsd != null
                            ? `$${row.estimatedCostUsd.toFixed(4)}`
                            : "—"}
                        </span>
                        <span>Rank: {row.rank}</span>
                      </div>
                      {/* Sources found */}
                      {row.sourcesFound && row.sourcesFound.length > 0 && (
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                            Sources found ({row.sourcesFound.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {row.sourcesFound.map((s) => (
                              <Badge
                                key={s}
                                variant="outline"
                                className="text-xs font-mono"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Competitor comparison */}
                      {row.competitorResults &&
                        row.competitorResults.length > 0 && (
                          <div className="pt-2 border-t border-border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                              Competitor citations
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {row.competitorResults.map((c) => (
                                <Badge
                                  key={c.name}
                                  variant={c.cited ? "default" : "secondary"}
                                  className={
                                    c.cited
                                      ? "bg-red-100 text-red-800"
                                      : ""
                                  }
                                >
                                  {c.name}: {c.cited ? "Cited" : "Not cited"}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      {/* Variant / repeat runs — carousel (one at a time) */}
                      {row.variantRuns && row.variantRuns.length > 0 && (() => {
                        const idx = runCarouselIndex[i] ?? 0;
                        const total = row.variantRuns!.length;
                        const v = row.variantRuns![idx];
                        return (
                          <div className="pt-3 border-t border-border space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {row.mode === "repeat" ? "Runs" : "Similar prompts"} — {idx + 1} / {total}
                              </p>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => setRunCarouselIndex((prev) => ({ ...prev, [i]: idx - 1 }))}
                                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === total - 1}
                                  onClick={() => setRunCarouselIndex((prev) => ({ ...prev, [i]: idx + 1 }))}
                                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setGeoFullResponseOpen({
                                  rowIndex: i,
                                  variantIndex: idx,
                                })
                              }
                              className="w-full rounded-md border border-border bg-muted/20 p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <p className="font-medium text-foreground mb-1">
                                &quot;{v.prompt}&quot;
                              </p>
                              <p className="text-muted-foreground text-xs leading-relaxed mb-2 line-clamp-3">
                                {v.snippet}
                              </p>
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge
                                  variant={v.cited ? "default" : "secondary"}
                                  className={v.cited ? "bg-emerald-100 text-emerald-800" : ""}
                                >
                                  {v.cited ? "Cited" : "Not cited"}
                                </Badge>
                                {v.citationTag && (
                                  <Badge variant="outline" className="text-xs font-normal">
                                    {v.citationTag}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground capitalize">
                                  {positionLabel(v.answerPosition)}
                                </span>
                                {v.confidenceScore != null && v.confidenceScore > 0 && (
                                  <Badge
                                    className={cn("text-xs", confidenceColor(v.confidenceScore))}
                                    title="Recommendation strength: Strong/Medium = endorsement language; Mention = cited only"
                                  >
                                    {confidenceLabel(v.confidenceScore)}
                                  </Badge>
                                )}
                                {v.sourcesFound && v.sourcesFound.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {v.sourcesFound.length} sources
                                  </span>
                                )}
                                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                                  <Maximize2 className="h-3 w-3" /> Full response
                                </span>
                              </div>
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Full response dialog */}
          <Dialog
            open={!!geoFullResponseOpen}
            onOpenChange={(open) => !open && setGeoFullResponseOpen(null)}
          >
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Full response</DialogTitle>
                <DialogDescription>
                  Complete model output for this similar prompt.
                </DialogDescription>
              </DialogHeader>
              {geoFullResponseOpen != null &&
                results[geoFullResponseOpen.rowIndex]?.variantRuns?.[
                  geoFullResponseOpen.variantIndex
                ] &&
                (() => {
                  const v =
                    results[geoFullResponseOpen!.rowIndex].variantRuns![
                      geoFullResponseOpen!.variantIndex
                    ];
                  const fullText = v.fullResponse ?? v.snippet;
                  return (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        &quot;{v.prompt}&quot;
                      </p>
                      <div className="rounded-md border border-border bg-muted/30 p-4 overflow-y-auto max-h-[50vh] text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {fullText}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={v.cited ? "default" : "secondary"}
                          className={
                            v.cited
                              ? "bg-emerald-100 text-emerald-800 w-fit"
                              : "w-fit"
                          }
                        >
                          {v.cited ? "Cited" : "Not cited"}
                        </Badge>
                        {v.citationTag && (
                          <Badge variant="outline" className="text-xs font-normal w-fit">
                            {v.citationTag}
                          </Badge>
                        )}
                        {v.answerPosition && (
                          <span className="text-xs text-muted-foreground capitalize">
                            Position: {positionLabel(v.answerPosition)}
                          </span>
                        )}
                        {v.confidenceScore != null &&
                          v.confidenceScore > 0 && (
                            <Badge
                              className={cn(
                                "text-xs",
                                confidenceColor(v.confidenceScore)
                              )}
                              title="Recommendation strength: Strong/Medium = endorsement language; Mention = cited only"
                            >
                              Recommendation:{" "}
                              {confidenceLabel(v.confidenceScore)} (
                              {v.confidenceScore}/5)
                            </Badge>
                          )}
                      </div>
                      {v.sourcesFound && v.sourcesFound.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {v.sourcesFound.map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {v.competitorResults &&
                        v.competitorResults.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {v.competitorResults.map((c) => (
                              <Badge
                                key={c.name}
                                variant={c.cited ? "default" : "secondary"}
                                className={
                                  c.cited ? "bg-red-100 text-red-800" : ""
                                }
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
        </>
      )}

      {activeTab === "identity" && (
        <>
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" />
                Identity Analysis
              </CardTitle>
              <CardDescription>
                We ask the model several questions about your URL and brand,
                then measure findability, mention rate, sentiment, and more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your URL</label>
                <Input
                  value={identityUrl}
                  onChange={(e) => setIdentityUrl(e.target.value)}
                  placeholder="https://www.yourcompany.com"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Company / brand name (optional)
                </label>
                <Input
                  value={identityCompanyName}
                  onChange={(e) => setIdentityCompanyName(e.target.value)}
                  placeholder="Your company or brand name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Key messages (optional, one per line)
                </label>
                <textarea
                  value={identityKeyMessages}
                  onChange={(e) => setIdentityKeyMessages(e.target.value)}
                  placeholder="e.g. We help brands optimize for AI search&#10;Leading GEO platform"
                  rows={3}
                  className={cn(
                    "border-input bg-background placeholder:text-muted-foreground",
                    "w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "resize-y min-h-[80px]"
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Used to compute attribute coverage: how many of these appear
                  in the model&apos;s answers.
                </p>
              </div>
              {identityError && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                  {identityError}
                </div>
              )}
              <Button
                onClick={handleRunIdentity}
                disabled={identityRunning || !identityUrl.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {identityRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Identity Analysis
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {identityResult && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-4 w-4 text-primary" />
                      Time to find
                    </CardTitle>
                    <CardDescription>
                      Query where your brand was first mentioned
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {identityResult.timeToFindQueryIndex != null ? (
                      <p className="text-2xl font-semibold">
                        Query #{identityResult.timeToFindQueryIndex}
                      </p>
                    ) : (
                      <p className="text-lg text-muted-foreground">
                        Not found in any query
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Percent className="h-4 w-4 text-primary" />
                      Mention rate
                    </CardTitle>
                    <CardDescription>
                      % of queries where the brand was mentioned
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">
                      {identityResult.mentionRatePercent}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {
                        identityResult.queryResults.filter((r) => r.mentioned)
                          .length
                      }{" "}
                      of {identityResult.queryResults.length} queries
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Attribute coverage
                    </CardTitle>
                    <CardDescription>
                      Key messages that appeared in answers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">
                      {identityResult.attributeCoveragePercent}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Sentiment
                    </CardTitle>
                    <CardDescription>
                      Tone when the brand is mentioned
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge
                      className={cn(
                        identityResult.sentiment === "positive" &&
                          "bg-emerald-100 text-emerald-800",
                        identityResult.sentiment === "negative" &&
                          "bg-red-100 text-red-800",
                        identityResult.sentiment === "neutral" &&
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {identityResult.sentiment}
                    </Badge>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="h-4 w-4 text-primary" />
                      Prominence
                    </CardTitle>
                    <CardDescription>
                      Where the brand appeared in responses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium capitalize">
                      {identityResult.prominence}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Query-type coverage
                    </CardTitle>
                    <CardDescription>
                      Query types where you were mentioned
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">
                      {identityResult.queryTypeCoverageCount} /{" "}
                      {identityResult.queryTypeCoverageTotal}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                  <CardDescription>
                    What the model said about you
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {identityResult.summary}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Per-query results</CardTitle>
                  <CardDescription>
                    Each question we asked and a snippet of the answer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Type</TableHead>
                        <TableHead className="max-w-[200px]">Query</TableHead>
                        <TableHead>Snippet</TableHead>
                        <TableHead className="w-[100px]">Mentioned</TableHead>
                        <TableHead className="w-[90px]">Position</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {identityResult.queryResults.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            {r.queryType}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">
                            {r.query}
                          </TableCell>
                          <TableCell className="max-w-[320px] p-0">
                            <button
                              type="button"
                              onClick={() =>
                                setIdentityFullResponseOpen(idx)
                              }
                              className="w-full px-3 py-2 text-left text-xs text-muted-foreground leading-relaxed line-clamp-2 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded flex items-center gap-1"
                            >
                              <span className="flex-1 min-w-0">
                                {r.snippet}
                              </span>
                              <Maximize2 className="h-3 w-3 shrink-0" />
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.mentioned ? "default" : "secondary"
                              }
                              className={
                                r.mentioned
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ""
                              }
                            >
                              {r.mentioned ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            {r.positionInResponse ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          <Dialog
            open={identityFullResponseOpen !== null}
            onOpenChange={(open) =>
              !open && setIdentityFullResponseOpen(null)
            }
          >
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Full response</DialogTitle>
                <DialogDescription>
                  Complete model output for this query.
                </DialogDescription>
              </DialogHeader>
              {identityResult &&
                identityFullResponseOpen !== null &&
                identityResult.queryResults[identityFullResponseOpen] &&
                (() => {
                  const r =
                    identityResult.queryResults[identityFullResponseOpen!];
                  const fullText = r.fullResponse ?? r.snippet;
                  return (
                    <>
                      <p className="text-xs font-medium text-muted-foreground">
                        {r.queryType}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        &quot;{r.query}&quot;
                      </p>
                      <div className="rounded-md border border-border bg-muted/30 p-4 overflow-y-auto max-h-[50vh] text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {fullText}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={r.mentioned ? "default" : "secondary"}
                          className={
                            r.mentioned
                              ? "bg-emerald-100 text-emerald-800 w-fit"
                              : "w-fit"
                          }
                        >
                          {r.mentioned ? "Mentioned" : "Not mentioned"}
                        </Badge>
                        {r.positionInResponse && (
                          <span className="text-xs text-muted-foreground">
                            Position: {r.positionInResponse}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
            </DialogContent>
          </Dialog>
        </>
      )}

      {activeTab === "history" && (
        <GeoHistoryPanel companyName={companyName.trim() || undefined} />
      )}
    </div>
  );
}

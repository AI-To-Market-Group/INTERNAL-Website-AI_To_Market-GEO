/**
 * Mock data for the dashboard when NEXT_PUBLIC_USE_MOCKS=true or when the API is unavailable.
 * Keeps all dashboard features working: filters (tous / tendance / saisonnier), shuffle,
 * theme filter, Top 4 table, opportunity cards, and navigation to article builder (with drag-and-drop).
 */

import type { Opportunity, OpportunitiesResponse, UserSettings, BigDate } from "@/types";
import { CONTENT_THEME_IDS } from "@/types";

const THEMES = [...CONTENT_THEME_IDS];

function makeId(prefix: string, i: number): string {
  return `mock-${prefix}-${i}`;
}

/** Mock opportunities: gap, trend, and date (seasonal) so all dashboard filters have data. */
export function getMockOpportunities(): Opportunity[] {
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  const opportunities: Opportunity[] = [];

  // SEO gap (competition) – AI To Market, marketing AI, sales AI, supply chain AI
  const gapTitles = [
    "AI marketing automation: AI To Market vs agency approach, 2026 comparison",
    "AI for B2B sales teams: what actually works vs vendor promises",
    "Generative AI in supply chain: real implementations and failure modes",
    "AI content strategy: building a GEO-optimised blog from scratch",
    "AI agents for revenue operations: costs, setup, and ROI benchmarks",
    "AI in demand forecasting: zombie content to reactivate",
    "Striking distance: AI consulting pages close to top 10",
    "Content gap: AI strategy vs AI implementation (competition)",
  ];
  gapTitles.forEach((title, i) => {
    opportunities.push({
      id: makeId("gap", i + 1),
      title,
      type: "SEO_GAP",
      subtype: i % 3 === 0 ? "CONTENT_GAP" : i % 3 === 1 ? "ZOMBIE_CONTENT" : "STRIKING_DISTANCE",
      theme: THEMES[i % THEMES.length],
      sources: ["gap"],
      score: 72 - i * 3 + (i % 4),
      impact_score: 72 - i * 3 + (i % 4),
      priority: i < 3 ? "haute" : i < 6 ? "moyenne" : "basse",
      content_brief: "Competitors are covering this topic, we are not.",
      intents: ["education", "comparison"],
      competitor_articles: [
        { source: "mckinsey.com", title: `${title} (competitor)`, link: "https://example.com/1" },
        { source: "gartner.com", title: "Competitor article on the theme", link: "https://example.com/2" },
      ],
      metrics: {
        search_volume: 1200 + i * 200,
        keyword_difficulty: 35 + i * 5,
        current_position: 12 + i,
        target_position: 5,
        trend_percentage: null,
        last_updated_days: 7,
        days_until_event: null,
        event_name: null,
        category: "AI Consulting",
        topic_quality: 70 + i,
        coverage_potential: 75,
        confidence: i < 4 ? "strong" : "good",
      },
      date_event_key: null,
      active_season: null,
    });
  });

  // Trends – AI marketing, sales AI, supply chain AI, GEO
  const trendTitles = [
    "Generative Engine Optimisation (GEO): how AI To Market builds AI-cited content",
    "AI agents in B2B sales: replacing SDRs or augmenting them?",
    "AI marketing automation 2026: tools, costs, and realistic timelines",
    "LLM-powered demand forecasting: real supply chain results",
    "AI content strategy: how brands get cited by ChatGPT and Perplexity",
    "Revenue operations and AI: building the stack without the bloat",
    "AI governance for mid-market: what actually needs a policy",
    "Claude vs GPT-4o for B2B content: a practitioner comparison",
  ];
  trendTitles.forEach((title, i) => {
    opportunities.push({
      id: makeId("trend", i + 1),
      title,
      type: "TREND",
      theme: THEMES[(i + 1) % THEMES.length],
      sources: ["trend"],
      score: 68 - i * 2 + (i % 3),
      impact_score: 68 - i * 2 + (i % 3),
      priority: i < 4 ? "haute" : "moyenne",
      content_brief: "Rising trend",
      intents: ["education", "lifestyle"],
      metrics: {
        search_volume: 800 + i * 150,
        keyword_difficulty: 42,
        current_position: null,
        target_position: null,
        trend_percentage: 15 + i * 5,
        last_updated_days: 3,
        days_until_event: null,
        event_name: null,
        category: "AI / B2B",
        topic_quality: 65 + i,
        coverage_potential: 70,
        confidence: "good",
      },
      date_event_key: null,
      active_season: null,
    });
  });

  // Seasonal (dates) – B2B industry events, tech conferences, AI budget cycles
  const seasonalEvents = [
    { name: "Valentine's Day", key: "Valentine's Day_2026-02-14", daysUntil: 5 },
    { name: "Grandparents' Day", key: "Grandparents' Day_2026-03-02", daysUntil: 21 },
    { name: "Easter", key: "Easter_2026-04-20", daysUntil: 70 },
    { name: "Back to school", key: "Back to school_2026-09-01", daysUntil: 184 },
  ];
  const seasonalTitles = [
    "Valentine's Day: AI-personalised marketing campaigns that actually convert",
    "Q1 planning: how to build your AI content strategy before the competition does",
    "Spring pipeline: using AI agents to accelerate B2B sales in Q2",
    "Back to school: AI tools for marketing teams returning from summer",
  ];
  seasonalEvents.forEach((ev, i) => {
    opportunities.push({
      id: makeId("date", i + 1),
      title: seasonalTitles[i] ?? ev.name,
      type: "SEASONAL",
      theme: THEMES[i % THEMES.length],
      sources: ["date"],
      score: 65 - i * 2,
      impact_score: 65 - i * 2,
      priority: "moyenne",
      content_brief: `Key Date: ${ev.name} D-${ev.daysUntil}`,
      intents: ["lifestyle", "awareness"],
      active_season: ev.name,
      date_event_key: ev.key,
      metrics: {
        search_volume: 2000,
        keyword_difficulty: 38,
        current_position: null,
        target_position: null,
        trend_percentage: null,
        last_updated_days: null,
        days_until_event: ev.daysUntil,
        event_name: ev.name,
        category: "Seasonal / AI",
        topic_quality: 72,
        coverage_potential: 78,
        confidence: "good",
      },
    });
  });

  return opportunities;
}

/** Mock opportunities response for useOpportunities. */
export function getMockOpportunitiesResponse(): OpportunitiesResponse {
  return {
    meta: {
      total_opportunities: getMockOpportunities().length,
      last_updated: new Date().toISOString(),
    },
    data: getMockOpportunities(),
  };
}

const MOCK_SETTINGS_STORAGE_KEY = "dashboard_settings_mock";

/** Default mock settings (keywords + big_dates). */
function getDefaultMockSettings(): UserSettings {
  return {
    seed_keywords: [
      "AI marketing automation",
      "AI for sales teams",
      "generative AI supply chain",
      "AI content strategy",
      "GEO generative engine optimization",
    ],
    big_dates: [
      {
        id: "aitom-date-q1-strategy",
        name: "Q1 Strategy Season",
        date_start: "2027-01-06",
        date_end: "2027-01-31",
        is_active: true,
        keywords: ["AI strategy planning", "AI roadmap 2027", "enterprise AI adoption", "AI implementation plan"],
        description: "Companies rolling out AI roadmaps after budget approval — peak demand for AI strategy content",
      },
      {
        id: "aitom-date-gartner-analytics",
        name: "Gartner Data & Analytics Summit",
        date_start: "2027-03-22",
        date_end: "2027-03-25",
        is_active: true,
        keywords: ["Gartner AI trends", "enterprise AI evaluation", "AI vendor selection", "AI maturity model"],
        description: "ICP actively evaluating AI vendors and strategies — high intent for consultancy content",
      },
      {
        id: "aitom-date-google-cloud-next",
        name: "Google Cloud Next",
        date_start: "2027-04-09",
        date_end: "2027-04-11",
        is_active: true,
        keywords: ["Google AI announcements", "Gemini for business", "cloud AI tools", "AI marketing platforms"],
        description: "Major AI product launches — ICP searching for implementation guidance",
      },
      {
        id: "aitom-date-hubspot-inbound",
        name: "HubSpot INBOUND",
        date_start: "2027-09-03",
        date_end: "2027-09-05",
        is_active: true,
        keywords: ["HubSpot AI", "AI marketing automation", "inbound marketing AI", "marketing AI tools"],
        description: "Largest marketing operations event — peak interest in AI for marketing teams",
      },
      {
        id: "aitom-date-dreamforce",
        name: "Salesforce Dreamforce",
        date_start: "2027-09-15",
        date_end: "2027-09-18",
        is_active: true,
        keywords: ["Salesforce AI", "Agentforce", "CRM automation", "AI for sales teams", "Einstein AI"],
        description: "Biggest CRM and sales AI event — ICP evaluating AI for sales and revenue operations",
      },
      {
        id: "aitom-date-year-end-budget",
        name: "Year-End AI Budget Push",
        date_start: "2027-11-01",
        date_end: "2027-11-30",
        is_active: true,
        keywords: ["AI budget planning", "AI ROI measurement", "enterprise AI spend", "AI implementation cost"],
        description: "Last spend window before fiscal close — AI procurement and consultancy decisions",
      },
      {
        id: "aitom-date-aws-reinvent",
        name: "AWS re:Invent",
        date_start: "2027-12-01",
        date_end: "2027-12-05",
        is_active: true,
        keywords: ["AWS AI", "Amazon Bedrock", "cloud AI infrastructure", "enterprise AI platforms", "AI agents"],
        description: "Cloud AI infrastructure decisions — major AI platform announcements drive ICP searches",
      },
    ] as BigDate[],
  };
}

const LEGACY_DATE_IDS = new Set(["mock-date-1", "mock-date-2"]);

/** Load mock settings: default + optional overlay from localStorage (so updates in mock mode persist). */
export function getMockSettings(): UserSettings {
  const base = getDefaultMockSettings();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(MOCK_SETTINGS_STORAGE_KEY);
    if (!raw) return base;
    const stored = JSON.parse(raw) as Partial<UserSettings>;

    // Auto-migrate: if stored dates are the old Essilor/retail defaults, replace with B2B defaults
    const storedDates = Array.isArray(stored.big_dates) ? stored.big_dates : [];
    const hasLegacyDates = storedDates.some((d: { id?: string }) => LEGACY_DATE_IDS.has(d.id ?? ""));
    const big_dates = hasLegacyDates ? base.big_dates : storedDates.length ? storedDates : base.big_dates;

    return {
      seed_keywords: Array.isArray(stored.seed_keywords) ? stored.seed_keywords : base.seed_keywords,
      big_dates,
    };
  } catch {
    return base;
  }
}

/** Persist mock settings to localStorage (used by useUpdateSettings in mock mode). */
export function setMockSettings(settings: Partial<UserSettings>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getMockSettings();
    const next: UserSettings = {
      seed_keywords: settings.seed_keywords ?? current.seed_keywords,
      big_dates: settings.big_dates ?? current.big_dates,
    };
    localStorage.setItem(MOCK_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

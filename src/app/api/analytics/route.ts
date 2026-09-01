import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUserId } from "@/lib/ga4-user";
import {
  getGAConnection,
  updateAccessToken,
} from "@/lib/ga4-oauth-store";

// Known AI / LLM referrer domains used to classify traffic
const AI_SOURCE_PATTERNS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "perplexity.ai",
  "claude.ai",
  "anthropic.com",
  "copilot.microsoft.com",
  "gemini.google.com",
  "bard.google.com",
  "you.com",
  "phind.com",
  "poe.com",
  "meta.ai",
  "bing.com/chat",
];

const AI_SOURCE_REGEX = new RegExp(
  AI_SOURCE_PATTERNS.map((d) => d.replace(/\./g, "\\.")).join("|"),
  "i"
);

function isAiSource(source: string): boolean {
  return AI_SOURCE_REGEX.test(source);
}

function classifyChannel(source: string, medium: string): string {
  if (isAiSource(source)) return "AI / LLM";
  const m = medium.toLowerCase();
  const s = source.toLowerCase();
  if (m === "organic" || m.includes("organic")) return "Organic Search";
  if (m === "cpc" || m === "ppc" || m.includes("paid")) return "Paid Search";
  if (m === "referral") return "Referral";
  if (m === "social" || m.includes("social")) return "Social";
  if (m === "email") return "Email";
  if (s === "(direct)" || m === "(none)") return "Direct";
  return "Other";
}

function getMockData(connection?: {
  connected: boolean;
  gaPropertyId?: string;
  gaPropertyDisplayName?: string;
}) {
  return {
    kpis: {
      sessions: 1_284,
      users: 943,
      pageviews: 3_712,
      bounceRate: 42.3,
      avgEngagementSec: 127,
    },
    trafficSources: [
      { channel: "Organic Search", sessions: 482, users: 371, percentage: 37.5 },
      { channel: "Direct", sessions: 324, users: 248, percentage: 25.2 },
      { channel: "Referral", sessions: 198, users: 152, percentage: 15.4 },
      { channel: "AI / LLM", sessions: 156, users: 103, percentage: 12.1 },
      { channel: "Social", sessions: 89, users: 51, percentage: 6.9 },
      { channel: "Other", sessions: 35, users: 18, percentage: 2.7 },
    ],
    aiBreakdown: [
      { source: "chatgpt.com", sessions: 98, users: 64, percentage: 62.8 },
      { source: "perplexity.ai", sessions: 31, users: 22, percentage: 19.9 },
      { source: "gemini.google.com", sessions: 14, users: 9, percentage: 9.0 },
      { source: "claude.ai", sessions: 8, users: 5, percentage: 5.1 },
      { source: "copilot.microsoft.com", sessions: 5, users: 3, percentage: 3.2 },
    ],
    topPages: [
      { path: "/", pageviews: 1_243, avgEngagementSec: 84 },
      { path: "/dashboard", pageviews: 892, avgEngagementSec: 214 },
      { path: "/atelier/ai-echo", pageviews: 634, avgEngagementSec: 312 },
      { path: "/insights", pageviews: 521, avgEngagementSec: 178 },
      { path: "/atelier/article-builder", pageviews: 422, avgEngagementSec: 267 },
    ],
    topCountries: [
      { country: "United States", sessions: 412, percentage: 32.1 },
      { country: "France", sessions: 298, percentage: 23.2 },
      { country: "United Kingdom", sessions: 164, percentage: 12.8 },
      { country: "Germany", sessions: 112, percentage: 8.7 },
      { country: "Canada", sessions: 78, percentage: 6.1 },
    ],
    dateRange: { start: "", end: "" },
    connection: connection ?? { connected: false },
    isMock: true,
  };
}

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

async function ensureAccessToken(userId: string) {
  const conn = await getGAConnection(userId);
  if (!conn || !conn.gaPropertyId || conn.gaPropertyId === "unknown") {
    return { connected: false as const, reason: "no_connection" as const };
  }

  let accessToken = conn.accessToken;
  let tokenExpiry = conn.tokenExpiry;

  const needsRefresh =
    !accessToken ||
    !tokenExpiry ||
    Date.now() > tokenExpiry - 60_000; // refresh 1min before expiry

  if (needsRefresh) {
    if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
      return {
        connected: false as const,
        reason: "oauth_not_configured" as const,
      };
    }

    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: conn.refreshToken,
        }),
      });

      if (!res.ok) {
        return {
          connected: false as const,
          reason: "refresh_failed" as const,
        };
      }

      const json = (await res.json()) as {
        access_token: string;
        expires_in?: number;
      };

      accessToken = json.access_token;
      tokenExpiry = Date.now() + (json.expires_in ?? 3600) * 1000;
      await updateAccessToken(userId, accessToken, tokenExpiry);
    } catch {
      return { connected: false as const, reason: "refresh_failed" as const };
    }
  }

  return {
    connected: true as const,
    accessToken,
    gaPropertyId: conn.gaPropertyId,
    gaPropertyDisplayName: conn.gaPropertyDisplayName,
  };
}

async function runReport(
  accessToken: string,
  property: string,
  body: unknown
) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `GA4 runReport failed (${res.status}): ${text.slice(0, 500)}`
    );
  }

  return (await res.json()) as {
    rows?: {
      dimensionValues?: { value?: string }[];
      metricValues?: { value?: string }[];
    }[];
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get("days") ?? "30", 10);

  let userId: string;
  try {
    userId = await getOrCreateUserId();
  } catch {
    userId = "anonymous";
  }

  const connection = await ensureAccessToken(userId);

  if (!connection.connected) {
    const mock = getMockData({ connected: false });
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    mock.dateRange = {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
    return NextResponse.json({
      ...mock,
      connection: { connected: false, reason: connection.reason },
    });
  }

  const startDate = `${days}daysAgo`;
  const endDate = "today";
  const property = connection.gaPropertyId;

  try {
    // Query 1: KPIs
    const kpiRes = await runReport(connection.accessToken, property, {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
      ],
    });

    const kpiRow = kpiRes.rows?.[0]?.metricValues ?? [];
    const kpis = {
      sessions: parseInt(kpiRow[0]?.value ?? "0"),
      users: parseInt(kpiRow[1]?.value ?? "0"),
      pageviews: parseInt(kpiRow[2]?.value ?? "0"),
      bounceRate: parseFloat(parseFloat(kpiRow[3]?.value ?? "0").toFixed(1)),
      avgEngagementSec: Math.round(parseFloat(kpiRow[4]?.value ?? "0")),
    };

    // Query 2: Traffic by source/medium
    const sourceRes = await runReport(connection.accessToken, property, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: "sessionSource" },
        { name: "sessionMedium" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 100,
    });

    const channelMap = new Map<string, { sessions: number; users: number }>();
    const aiMap = new Map<string, { sessions: number; users: number }>();

    for (const row of sourceRes.rows ?? []) {
      const source = row.dimensionValues?.[0]?.value ?? "(unknown)";
      const medium = row.dimensionValues?.[1]?.value ?? "(none)";
      const sessions = parseInt(row.metricValues?.[0]?.value ?? "0");
      const users = parseInt(row.metricValues?.[1]?.value ?? "0");
      const channel = classifyChannel(source, medium);

      const existing = channelMap.get(channel) ?? { sessions: 0, users: 0 };
      channelMap.set(channel, {
        sessions: existing.sessions + sessions,
        users: existing.users + users,
      });

      if (isAiSource(source)) {
        const aiExisting = aiMap.get(source) ?? { sessions: 0, users: 0 };
        aiMap.set(source, {
          sessions: aiExisting.sessions + sessions,
          users: aiExisting.users + users,
        });
      }
    }

    const totalSessions = Array.from(channelMap.values()).reduce(
      (sum, v) => sum + v.sessions,
      0
    );

    const trafficSources = Array.from(channelMap.entries())
      .map(([channel, data]) => ({
        channel,
        sessions: data.sessions,
        users: data.users,
        percentage: totalSessions > 0
          ? parseFloat(((data.sessions / totalSessions) * 100).toFixed(1))
          : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);

    const totalAiSessions = Array.from(aiMap.values()).reduce(
      (sum, v) => sum + v.sessions,
      0
    );

    const aiBreakdown = Array.from(aiMap.entries())
      .map(([source, data]) => ({
        source,
        sessions: data.sessions,
        users: data.users,
        percentage: totalAiSessions > 0
          ? parseFloat(((data.sessions / totalAiSessions) * 100).toFixed(1))
          : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);

    // Query 3: Top pages
    const pagesRes = await runReport(connection.accessToken, property, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
      ],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    });

    const topPages = (pagesRes.rows ?? []).map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? "/",
      pageviews: parseInt(row.metricValues?.[0]?.value ?? "0"),
      avgEngagementSec: Math.round(
        parseFloat(row.metricValues?.[1]?.value ?? "0")
      ),
    }));

    // Query 4: Top countries
    const geoRes = await runReport(connection.accessToken, property, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    });

    const totalGeoSessions = (geoRes.rows ?? []).reduce(
      (sum, row) => sum + parseInt(row.metricValues?.[0]?.value ?? "0"),
      0
    );

    const topCountries = (geoRes.rows ?? []).map((row) => {
      const sessions = parseInt(row.metricValues?.[0]?.value ?? "0");
      return {
        country: row.dimensionValues?.[0]?.value ?? "Unknown",
        sessions,
        percentage: totalGeoSessions > 0
          ? parseFloat(((sessions / totalGeoSessions) * 100).toFixed(1))
          : 0,
      };
    });

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    return NextResponse.json({
      kpis,
      trafficSources,
      aiBreakdown,
      topPages,
      topCountries,
      dateRange: {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      },
      connection: {
        connected: true,
        gaPropertyId: connection.gaPropertyId,
        gaPropertyDisplayName: connection.gaPropertyDisplayName,
      },
      isMock: false,
    });
  } catch (error) {
    console.error("GA4 API error:", error);
    const mock = getMockData({
      connected: true,
      gaPropertyId: connection.gaPropertyId,
      gaPropertyDisplayName: connection.gaPropertyDisplayName,
    });
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    mock.dateRange = {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
    return NextResponse.json({ ...mock, error: String(error) });
  }
}

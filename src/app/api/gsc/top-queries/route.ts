import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getGSCConnection, refreshGSCTokenIfNeeded } from "@/lib/gsc-oauth-store";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const conn = await getGSCConnection();
  if (!conn) {
    return NextResponse.json({ connected: false, queries: [] }, { status: 200 });
  }

  const fresh = await refreshGSCTokenIfNeeded(conn).catch(() => conn);

  // 90-day window
  const endDate   = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 90);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Try stored siteUrl first, then common fallback formats
  const siteUrlCandidates = [
    fresh.siteUrl,
    "sc-domain:aitomarketgroup.com",
    "https://aitomarketgroup.com/",
    "https://www.aitomarketgroup.com/",
  ].filter((s, i, arr) => s && arr.indexOf(s) === i);

  let res: Response | null = null;
  let usedSiteUrl = fresh.siteUrl;

  for (const siteUrl of siteUrlCandidates) {
    const attempt = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${fresh.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate:  fmt(startDate),
          endDate:    fmt(endDate),
          dimensions: ["query"],
          rowLimit:   30,
          orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
        }),
      }
    );
    if (attempt.ok) { res = attempt; usedSiteUrl = siteUrl; break; }
    const body = await attempt.text().catch(() => "");
    console.error(`[GSC top-queries] ${siteUrl} → ${attempt.status}`, body.slice(0, 200));
  }

  if (!res) {
    return NextResponse.json({ connected: true, queries: [], error: "GSC API: no matching site property found" }, { status: 200 });
  }

  const data = (await res.json()) as {
    rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
  };

  const queries = (data.rows ?? []).map((r) => ({
    query:       r.keys[0],
    clicks:      r.clicks,
    impressions: r.impressions,
    position:    Math.round(r.position * 10) / 10,
  }));

  return NextResponse.json({ connected: true, siteUrl: usedSiteUrl, queries });
}

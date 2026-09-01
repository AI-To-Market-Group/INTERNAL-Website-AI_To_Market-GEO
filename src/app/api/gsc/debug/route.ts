import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getGSCConnection, refreshGSCTokenIfNeeded } from "@/lib/gsc-oauth-store";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const conn = await getGSCConnection(user.id);
  if (!conn) {
    return NextResponse.json({ connected: false, storedSiteUrl: null, availableSites: [] });
  }

  const fresh = await refreshGSCTokenIfNeeded(conn).catch(() => conn);

  const sitesRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${fresh.accessToken}` },
  });

  const sitesJson = sitesRes.ok
    ? ((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] })
    : { siteEntry: [] };

  return NextResponse.json({
    connected: true,
    storedSiteUrl: fresh.siteUrl,
    availableSites: sitesJson.siteEntry ?? [],
  });
}

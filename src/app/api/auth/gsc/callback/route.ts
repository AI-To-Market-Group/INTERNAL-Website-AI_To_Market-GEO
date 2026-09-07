import { NextRequest, NextResponse } from "next/server";
import { saveGSCConnection } from "@/lib/gsc-oauth-store";

const CLIENT_ID     = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI_GSC;

function abs(req: NextRequest, path: string) {
  return `${req.nextUrl.origin}${path}`;
}

export async function GET(req: NextRequest) {
  const url   = req.nextUrl;
  const code  = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");

  if (error) {
    return NextResponse.redirect(abs(req, `/atelier?gsc_error=${encodeURIComponent(error)}`));
  }
  if (!code) {
    return NextResponse.redirect(abs(req, "/atelier?gsc_error=missing_code"));
  }
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return NextResponse.redirect(abs(req, "/atelier?gsc_error=not_configured"));
  }

  // Decode state for returnTo only
  let returnTo = "/atelier";
  if (stateParam) {
    try {
      const parsed = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8"));
      returnTo = parsed.returnTo ?? "/atelier";
    } catch { /* ignore */ }
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    "authorization_code",
      code,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    console.error("[GSC callback] token exchange failed:", tokenRes.status, body);
    return NextResponse.redirect(abs(req, "/atelier?gsc_error=token_exchange_failed"));
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.refresh_token) {
    return NextResponse.redirect(abs(req, "/atelier?gsc_error=missing_refresh_token"));
  }

  // Auto-discover the verified GSC site for aitomarketgroup.com
  let siteUrl = "sc-domain:aitomarketgroup.com"; // sensible default
  try {
    const sitesRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (sitesRes.ok) {
      const sitesJson = (await sitesRes.json()) as {
        siteEntry?: { siteUrl: string; permissionLevel: string }[];
      };
      // Prefer domain property (sc-domain:) or the production URL
      const entries = sitesJson.siteEntry ?? [];
      const match =
        entries.find((s) => s.siteUrl.includes("aitomarketgroup")) ??
        entries.find((s) => s.siteUrl.startsWith("sc-domain:")) ??
        entries[0];
      if (match) siteUrl = match.siteUrl;
    }
  } catch (e) {
    console.error("[GSC callback] sites list failed:", e);
  }

  await saveGSCConnection({
    siteUrl,
    accessToken:  tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiry:  Date.now() + (tokens.expires_in ?? 3600) * 1000,
  });

  return NextResponse.redirect(abs(req, returnTo));
}

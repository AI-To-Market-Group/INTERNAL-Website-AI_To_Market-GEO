import { NextRequest, NextResponse } from "next/server";
import {
  getGAConnection,
  saveGAConnection,
  updateAccessToken,
} from "@/lib/ga4-oauth-store";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI;

function absoluteUrl(req: NextRequest, path: string): string {
  const origin = req.nextUrl.origin;
  return `${origin}${path}`;
}

export async function GET(req: NextRequest) {
  // Prefer Supabase authenticated user; fall back to the cookie UUID embedded
  // in the OAuth state so single-user deployments work without a login wall.
  let userId = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  } catch { /* no Supabase session */ }

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      absoluteUrl(req, `/atelier/authority?error=${encodeURIComponent(error)}`)
    );
  }

  if (!code) {
    return NextResponse.redirect(absoluteUrl(req, "/atelier/authority?error=missing_code_from_google"));
  }

  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
    return NextResponse.redirect(absoluteUrl(req, "/atelier/authority?error=oauth_not_configured"));
  }

  let state: { userId?: string; returnTo?: string } = {};
  if (stateParam) {
    try {
      const json = Buffer.from(stateParam, "base64url").toString("utf8");
      state = JSON.parse(json);
    } catch {
      // ignore malformed state
    }
  }

  // If no Supabase session, use the cookie UUID embedded by the start route
  if (!userId) userId = state.userId ?? "";
  if (!userId) {
    return NextResponse.redirect(absoluteUrl(req, "/atelier/authority?error=unauthenticated"));
  }

  const returnTo = state.returnTo
    ? absoluteUrl(req, state.returnTo)
    : absoluteUrl(req, "/atelier/authority");

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => "");
    console.error("Token exchange failed:", tokenRes.status, errBody);
    return NextResponse.redirect(absoluteUrl(req, "/atelier/authority?error=token_exchange_failed"));
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const existing = await getGAConnection(userId);
  const accessToken = tokenJson.access_token;
  const refreshToken = tokenJson.refresh_token || existing?.refreshToken || "";
  const tokenExpiry = Date.now() + (tokenJson.expires_in ?? 3600) * 1000;

  if (!refreshToken) {
    return NextResponse.redirect(absoluteUrl(req, "/atelier/authority?error=missing_refresh_token"));
  }

  // Auto-discover the first GA4 property
  let gaPropertyId = (existing?.gaPropertyId && existing.gaPropertyId !== "unknown") ? existing.gaPropertyId : "";
  let gaPropertyDisplayName = existing?.gaPropertyDisplayName;

  if (!gaPropertyId) {
    try {
      const adminRes = await fetch(
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (adminRes.ok) {
        const adminJson = (await adminRes.json()) as {
          accountSummaries?: {
            propertySummaries?: { property?: string; displayName?: string }[];
          }[];
        };
        const firstProperty = adminJson.accountSummaries?.[0]?.propertySummaries?.[0];
        if (firstProperty?.property) {
          gaPropertyId = firstProperty.property;
          gaPropertyDisplayName = firstProperty.displayName;
        }
      } else {
        const adminErr = await adminRes.text().catch(() => "");
        console.error("GA4 Admin API error:", adminRes.status, adminErr);
      }
    } catch (e) {
      console.error("GA4 Admin API exception:", e);
    }
  }

  if (!gaPropertyId) {
    await saveGAConnection({ userId, gaPropertyId: "unknown", gaPropertyDisplayName, accessToken, refreshToken, tokenExpiry });
    return NextResponse.redirect(absoluteUrl(req, "/atelier/authority?error=no_ga4_property_found"));
  }

  await saveGAConnection({ userId, gaPropertyId, gaPropertyDisplayName, accessToken, refreshToken, tokenExpiry });
  await updateAccessToken(userId, accessToken, tokenExpiry);

  return NextResponse.redirect(returnTo);
}

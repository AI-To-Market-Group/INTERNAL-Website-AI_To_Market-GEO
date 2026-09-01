import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUserId } from "@/lib/ga4-user";

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI;

export async function GET(req: NextRequest) {
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_REDIRECT_URI) {
    return NextResponse.json(
      {
        error:
          "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_REDIRECT_URI.",
      },
      { status: 500 }
    );
  }

  const userId = await getOrCreateUserId();
  const returnTo =
    req.nextUrl.searchParams.get("returnTo") ?? "/atelier/authority";

  const state = Buffer.from(
    JSON.stringify({ userId, returnTo }),
    "utf8"
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(url);
}


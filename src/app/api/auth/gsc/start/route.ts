import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CLIENT_ID    = process.env.GOOGLE_OAUTH_CLIENT_ID;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI_GSC;

export async function GET(req: NextRequest) {
  if (!CLIENT_ID || !REDIRECT_URI) {
    return NextResponse.json({ error: "GSC OAuth not configured." }, { status: 500 });
  }

  let userId = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  } catch { /* no session */ }

  const returnTo = req.nextUrl.searchParams.get("returnTo") ?? "/atelier";
  const state = Buffer.from(JSON.stringify({ userId, returnTo }), "utf8").toString("base64url");

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: "code",
    access_type:   "offline",
    prompt:        "consent",
    scope:         "https://www.googleapis.com/auth/webmasters.readonly",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}

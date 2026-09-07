import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CLIENT_ID   = process.env.GOOGLE_OAUTH_CLIENT_ID;
const ADMIN_EMAIL = "manoj@aitomarketgroup.com";

export async function GET(req: NextRequest) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: "GSC OAuth not configured." }, { status: 500 });
  }

  const REDIRECT_URI = `${req.nextUrl.origin}/api/auth/gsc/callback`;

  // Only the admin can initiate the org-level GSC connection
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Only an admin can connect Search Console." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const returnTo = req.nextUrl.searchParams.get("returnTo") ?? "/atelier";
  const state = Buffer.from(JSON.stringify({ returnTo }), "utf8").toString("base64url");

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

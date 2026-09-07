import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string };
  try {
    body = (await req.json()) as { email?: string; source?: string };
  } catch {
    return err("Invalid request body", 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return err("Invalid email address", 400);
  }

  const scriptUrl = process.env.GOOGLE_SHEETS_SCRIPT_URL;
  if (!scriptUrl) {
    // Gracefully acknowledge — don't expose missing config to client
    console.warn("[subscribe] GOOGLE_SHEETS_SCRIPT_URL not set — email not saved:", email);
    return ok({ message: "Subscribed" });
  }

  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        source: body.source ?? "newsletter-footer",
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[subscribe] Apps Script error:", res.status, text.slice(0, 200));
      return err("Subscription failed — please try again", 500);
    }
  } catch (e) {
    console.error("[subscribe] fetch to Apps Script failed:", e);
    return err("Subscription failed — please try again", 500);
  }

  return ok({ message: "Subscribed" });
}

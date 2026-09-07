import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { dbGetUsageSummary } from "@/lib/db/ai-usage";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const days = Number(new URL(req.url).searchParams.get("days") ?? "30");

  try {
    const summary = await dbGetUsageSummary(user.id, Math.min(Math.max(days, 1), 365));
    return ok(summary);
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message)
          : JSON.stringify(e);
    console.error("[usage] dbGetUsageSummary error:", msg, e);
    return err(msg || "Failed to load usage", 500);
  }
}

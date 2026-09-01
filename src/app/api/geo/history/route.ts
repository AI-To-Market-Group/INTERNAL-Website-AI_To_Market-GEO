import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { dbGetGeoRunHistory, dbGetGeoRunById } from "@/lib/db/geo-runs";
import { requireUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const companyName = url.searchParams.get("company") ?? undefined;
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const runId = url.searchParams.get("runId") ?? undefined;

  if (runId) {
    const run = await dbGetGeoRunById(user.id, runId);
    return ok({ run });
  }

  const runs = await dbGetGeoRunHistory(user.id, companyName, limit);
  return ok({ runs, total: runs.length });
}

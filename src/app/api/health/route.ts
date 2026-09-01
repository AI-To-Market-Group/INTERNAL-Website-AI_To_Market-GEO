import { ok } from "@/lib/api-response";
import { isDbAvailable } from "@/lib/db";

export async function GET() {
  return ok({
    ok: true,
    db: isDbAvailable() ? "configured" : "unconfigured",
    timestamp: new Date().toISOString(),
  });
}

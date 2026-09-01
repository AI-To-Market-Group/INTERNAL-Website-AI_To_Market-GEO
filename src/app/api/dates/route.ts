import type { NextRequest } from "next/server";
import { getDates, patchDates } from "@/lib/settings-store";
import { ok, parseBody } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { z } from "zod";

const bigDateSchema = z.object({
  id: z.string(),
  name: z.string(),
  date_start: z.string(),
  date_end: z.string().optional(),
  is_active: z.boolean(),
  keywords: z.array(z.string()),
  description: z.string().optional(),
}).passthrough();

const patchDatesSchema = z.object({
  big_dates: z.array(bigDateSchema).optional(),
});

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const data = await getDates(user.id);
  return ok(data);
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = await parseBody(req, patchDatesSchema);
  if (parsed.error) return parsed.error;

  const dates = parsed.data.big_dates ?? [];
  const updated = await patchDates(user.id, dates);
  return ok(updated);
}

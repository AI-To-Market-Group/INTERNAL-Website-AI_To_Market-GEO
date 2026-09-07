import { ok, err } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { getBudget, setBudget } from "@/lib/budget-guard";
import type { NextRequest } from "next/server";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  try {
    const budget = await getBudget(user.id);
    return ok({ budget });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Failed to read budget", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  try {
    const { budget } = (await req.json()) as { budget?: unknown };
    const n = Number(budget);
    if (!Number.isInteger(n) || n < 1) return err("budget must be a positive integer", 400);
    await setBudget(user.id, n);
    return ok({ budget: n });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Failed to save budget", 500);
  }
}

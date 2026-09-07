import { supabaseAdmin } from "@/lib/supabase/admin";

export interface BudgetStatus {
  allowed: boolean;
  count: number;
  budget: number;
  pct: number;
}

const DEFAULT_BUDGET = 200;

export async function checkBudget(userId: string): Promise<BudgetStatus> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [countResult, budgetResult] = await Promise.all([
    supabaseAdmin
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since.toISOString()),
    supabaseAdmin
      .from("user_budget_settings")
      .select("monthly_call_budget")
      .eq("user_id", userId)
      .single(),
  ]);

  const count = countResult.count ?? 0;
  const budget = budgetResult.data?.monthly_call_budget ?? DEFAULT_BUDGET;
  const pct = budget > 0 ? (count / budget) * 100 : 100;

  return { allowed: count < budget, count, budget, pct };
}

export async function getBudget(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("user_budget_settings")
    .select("monthly_call_budget")
    .eq("user_id", userId)
    .single();
  return data?.monthly_call_budget ?? DEFAULT_BUDGET;
}

export async function setBudget(userId: string, budget: number): Promise<void> {
  await supabaseAdmin
    .from("user_budget_settings")
    .upsert({ user_id: userId, monthly_call_budget: budget, updated_at: new Date().toISOString() });
}

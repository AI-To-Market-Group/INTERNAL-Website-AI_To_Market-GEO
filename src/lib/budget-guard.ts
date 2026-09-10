import { supabaseAdmin } from "@/lib/supabase/admin";

export interface BudgetStatus {
  allowed: boolean;
  count: number;
  budget: number;
  pct: number;
}

const DEFAULT_BUDGET = 200;
const ORG_KEY = "org";

export async function checkBudget(_userId: string): Promise<BudgetStatus> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [countResult, budgetResult] = await Promise.all([
    supabaseAdmin
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since.toISOString()),
    supabaseAdmin
      .from("user_budget_settings")
      .select("monthly_call_budget")
      .eq("user_id", ORG_KEY)
      .single(),
  ]);

  const count = countResult.count ?? 0;
  const budget = budgetResult.data?.monthly_call_budget ?? DEFAULT_BUDGET;
  const pct = budget > 0 ? (count / budget) * 100 : 100;

  return { allowed: count < budget, count, budget, pct };
}

export async function getBudget(_userId?: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("user_budget_settings")
    .select("monthly_call_budget")
    .eq("user_id", ORG_KEY)
    .single();
  return data?.monthly_call_budget ?? DEFAULT_BUDGET;
}

export async function setBudget(_userId: string | undefined, budget: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_budget_settings")
    .upsert({ user_id: ORG_KEY, monthly_call_budget: budget, updated_at: new Date().toISOString() });
  if (error) throw new Error(`setBudget failed: ${error.message}`);
}

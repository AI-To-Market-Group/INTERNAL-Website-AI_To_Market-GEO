import { supabaseAdmin } from "@/lib/supabase/admin";

// Pricing per 1M tokens (USD) — update when OpenAI publishes new rates
// gpt-5.4-* prices are estimates; verify at platform.openai.com/docs/pricing
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o":                     { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":                { input: 0.15,  output: 0.60  },
  "gpt-4o-mini-search-preview": { input: 0.15,  output: 0.60  },
  "gpt-5.4-nano":               { input: 0.15,  output: 0.60  },
  "gpt-5.4-mini":               { input: 0.40,  output: 1.60  },
  "gpt-5.4":                    { input: 2.50,  output: 10.00 },
};

// Conservative fallback for unknown models
const FALLBACK = { input: 0.50, output: 2.00 };

export function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? FALLBACK;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function logAiUsage(params: {
  userId: string | null;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): void {
  const estimatedUsd = estimateUsd(params.model, params.inputTokens, params.outputTokens);
  void supabaseAdmin
    .from("ai_usage_log")
    .insert({
      user_id: params.userId,
      feature: params.feature,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_usd: estimatedUsd,
    })
    .then(({ error }) => {
      if (error) console.error("[ai-usage] log failed:", error.message);
    });
}

import { supabaseAdmin } from "@/lib/supabase/admin";

// Pricing per 1M tokens (USD)
// OpenAI: verify at platform.openai.com/docs/pricing
// Anthropic: verify at platform.claude.com/docs/en/about-claude/pricing
// gpt-5.4-* prices are estimates
const PRICING: Record<string, { input: number; output: number }> = {
  // ── OpenAI ────────────────────────────────────────────────
  "gpt-4o":                     { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":                { input: 0.15,  output: 0.60  },
  "gpt-4o-mini-search-preview": { input: 0.15,  output: 0.60  },
  "gpt-5.4-nano":               { input: 0.15,  output: 0.60  },
  "gpt-5.4-mini":               { input: 0.40,  output: 1.60  },
  "gpt-5.4":                    { input: 2.50,  output: 10.00 },
  // ── Anthropic ─────────────────────────────────────────────
  // Image/vision tokens billed at the same rate as text input tokens
  "claude-sonnet-5":            { input: 2.00,  output: 10.00 },
  "claude-sonnet-4-5":          { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5":           { input: 0.80,  output: 4.00  },
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

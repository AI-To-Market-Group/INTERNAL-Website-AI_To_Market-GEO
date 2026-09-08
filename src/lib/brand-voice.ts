import { supabaseAdmin } from "@/lib/supabase/admin";

export interface BrandVoiceRow {
  brand_description: string;
  audience: string;
  tone: string[];
  preferred_style: string[];
  forbidden_phrases: string[];
  guardrails: { label: string; active: boolean }[];
}

// ── Hardcoded defaults — used as fallback if DB is empty or unreachable ───────
// These are the original values that made generation quality what it is today.
// The DB is seeded with these on first migration, so they should always match.
// Exported as BRAND_VOICE for backward compatibility with brand-voice-checker.ts
export const DEFAULT: BrandVoiceRow = {
  brand_description:
    "Specialist AI strategy and implementation consultancy helping enterprise and mid-market businesses deploy AI across marketing, sales, and supply chain — founded by practitioners, not theorists.",
  audience:
    "CMOs, heads of marketing, VP Sales, revenue operations leads, supply chain managers, and digital transformation directors at mid-to-large companies. They understand their business problems — write past generic AI hype and vendor promises.",
  tone: [
    "Practitioner-to-practitioner — like a senior consultant who has shipped real AI implementations explaining what actually works, not a vendor pitch.",
    "Specific and commercial — real outcomes, real timelines, real tradeoffs.",
    "Sceptical of AI hype, honest about limitations. Acknowledge failure modes and change management challenges.",
    "Decisive and direct. No hedge-everything corporate speak.",
  ],
  preferred_style: [
    "Name specific AI tools, models, and platforms — Claude, GPT-4o, Perplexity, n8n, Make, Salesforce Einstein — not vague 'AI solutions'.",
    "Active voice. Real subjects doing real things.",
    "Real business outcomes with numbers: 'reduced MQL-to-SQL cycle by 40%' not 'improved efficiency'.",
    "Client scenarios: 'a CMO at a €200M retail brand' or 'a head of sales ops at a B2B SaaS company' not 'business leaders'.",
    "Acknowledge the messy reality — AI implementations overrun budgets, change management is slow, adoption takes longer than promised.",
    "Skip definition openers like 'AI is transforming X' — start with a result, a failure mode, or a specific business scenario instead.",
  ],
  forbidden_phrases: [
    "in today's fast-paced world",
    "in today's digital age",
    "leverage",
    "synergize",
    "holistic approach",
    "game-changing",
    "revolutionary",
    "cutting-edge",
    "best-in-class",
    "world-class",
    "next-generation",
    "transformative",
    "needless to say",
    "it's important to note",
    "as we can see",
    "in order to",
    "utilize",
    "robust solution",
    "delve into",
    "harness the power of",
    "unlock your potential",
    "at the forefront",
    "seamlessly",
  ],
  guardrails: [
    { label: "Never claim a number without a source", active: true },
    { label: "No product mentions before the final section", active: true },
    { label: "Flag any sentence over 30 words", active: false },
  ],
};

export const BRAND_VOICE = DEFAULT;

// ── In-memory cache (per server instance) ─────────────────────────────────────
let _cache: BrandVoiceRow | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateBrandVoiceCache() {
  _cache = null;
  _cachedAt = 0;
}

async function loadBrandVoice(): Promise<BrandVoiceRow> {
  if (_cache && Date.now() - _cachedAt < CACHE_TTL_MS) return _cache;
  try {
    const { data } = await supabaseAdmin
      .from("brand_voice")
      .select("brand_description,audience,tone,preferred_style,forbidden_phrases,guardrails")
      .order("id", { ascending: true })
      .limit(1)
      .single();
    _cache = (data as BrandVoiceRow | null) ?? DEFAULT;
  } catch {
    _cache = DEFAULT;
  }
  _cachedAt = Date.now();
  return _cache;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function getBrandVoicePrompt(): Promise<string> {
  const bv = await loadBrandVoice();
  const activeGuardrails = bv.guardrails.filter(g => g.active);
  return `BRAND CONTEXT
─────────────
You are writing for AI To Market: ${bv.brand_description}

AUDIENCE
${bv.audience}

TONE
${bv.tone.map(t => `- ${t}`).join("\n")}

STYLE PREFERENCES
${bv.preferred_style.map(s => `- ${s}`).join("\n")}

FORBIDDEN PHRASES (do not use under any circumstance)
${bv.forbidden_phrases.map(p => `- "${p}"`).join("\n")}${
    activeGuardrails.length
      ? `\n\nHARD RULES\n${activeGuardrails.map(g => `- ${g.label}`).join("\n")}`
      : ""
  }`;
}

export async function getBrandVoiceCompact(): Promise<string> {
  const bv = await loadBrandVoice();
  return `Writing for AI To Market: ${bv.brand_description.split("—")[0].trim()}. Audience: ${bv.audience.split(".")[0]}. Tone: practitioner-level, specific, no consulting jargon. Avoid: ${bv.forbidden_phrases.slice(0, 6).join(", ")}.`;
}

export async function getBrandVoiceRaw(): Promise<BrandVoiceRow> {
  return loadBrandVoice();
}

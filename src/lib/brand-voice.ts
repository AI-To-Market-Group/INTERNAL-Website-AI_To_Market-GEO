/**
 * Brand Voice — single source of truth for brand context, audience, and tone
 * injected into every LLM prompt in the article-builder pipeline.
 *
 * Why this exists: prompts were generic B2B SaaS by default, producing bland
 * "AI tools are revolutionising customer experience" prose. Now every route
 * shares the same brand context, audience, and forbidden phrases.
 */

export const BRAND_VOICE = {
  brand: "AI To Market",
  brand_description:
    "Specialist AI strategy and implementation consultancy helping enterprise and mid-market businesses deploy AI across marketing, sales, and supply chain — founded by practitioners, not theorists.",
  brands_owned: [
    "AI To Market",
  ],
  audience:
    "CMOs, heads of marketing, VP Sales, revenue operations leads, supply chain managers, and digital transformation directors at mid-to-large companies. They understand their business problems — write past generic AI hype and vendor promises.",
  tone: [
    "Practitioner-to-practitioner — like a senior consultant who has shipped real AI implementations explaining what actually works, not a vendor pitch.",
    "Specific and commercial — real outcomes, real timelines, real tradeoffs.",
    "Sceptical of AI hype, honest about limitations. Acknowledge failure modes and change management challenges.",
    "Decisive and direct. No hedge-everything corporate speak.",
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
  preferred_style: [
    "Name specific AI tools, models, and platforms — Claude, GPT-4o, Perplexity, n8n, Make, Salesforce Einstein — not vague 'AI solutions'.",
    "Active voice. Real subjects doing real things.",
    "Real business outcomes with numbers: 'reduced MQL-to-SQL cycle by 40%' not 'improved efficiency'.",
    "Client scenarios: 'a CMO at a €200M retail brand' or 'a head of sales ops at a B2B SaaS company' not 'business leaders'.",
    "Acknowledge the messy reality — AI implementations overrun budgets, change management is slow, adoption takes longer than promised.",
    "Skip definition openers like 'AI is transforming X' — start with a result, a failure mode, or a specific business scenario instead.",
  ],
};

/**
 * Returns the formatted brand-voice block to inject into a system prompt.
 * Call once at the top of any LLM-facing route, append to the system message.
 */
export function getBrandVoicePrompt(): string {
  return `BRAND CONTEXT
─────────────
You are writing for ${BRAND_VOICE.brand}: ${BRAND_VOICE.brand_description}

AUDIENCE
${BRAND_VOICE.audience}

TONE
${BRAND_VOICE.tone.map((t) => `- ${t}`).join("\n")}

STYLE PREFERENCES
${BRAND_VOICE.preferred_style.map((s) => `- ${s}`).join("\n")}

FORBIDDEN PHRASES (do not use under any circumstance)
${BRAND_VOICE.forbidden_phrases.map((p) => `- "${p}"`).join("\n")}`;
}

/**
 * Compact one-line brand reference, for prompts where space matters
 * (e.g. revise-selection, revise-section).
 */
export function getBrandVoiceCompact(): string {
  return `Writing for ${BRAND_VOICE.brand}: ${BRAND_VOICE.brand_description.split("—")[0].trim()}. Audience: ${BRAND_VOICE.audience.split(".")[0]}. Tone: practitioner-level, specific, no consulting jargon. Avoid: ${BRAND_VOICE.forbidden_phrases.slice(0, 6).join(", ")}.`;
}

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { logAiUsage } from "@/lib/ai-usage-logger";
import { checkBudget } from "@/lib/budget-guard";

// ── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = ["#F7F5F2", "#163D26", "#185F00", "#FFFFFF", "#F93943", "#F88379"] as const;
const PALETTE_UPPER = new Set(PALETTE.map(h => h.toUpperCase()));

function extractColors(svg: string): string[] {
  const found: string[] = [];
  const re = /(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) found.push(m[1].toUpperCase());
  return found;
}

function validateSvg(svg: string): { valid: boolean; reason?: string } {
  const colors = extractColors(svg);
  for (const color of colors) {
    if (!PALETTE_UPPER.has(color)) return { valid: false, reason: `Off-palette: ${color}` };
  }
  const hasRed   = colors.includes("#F93943");
  const hasCoral = colors.includes("#F88379");
  if (hasRed && hasCoral) return { valid: false, reason: "Both red and coral used" };
  if (hasCoral) return { valid: false, reason: "Coral forbidden on light surface" };
  return { valid: true };
}

function buildPrompt(heading: string, sectionType: string, summary: string): string {
  return `Design an editorial illustration for a B2B AI article. Create a small readable SVG scene that shows the section's core story as a narrative diagram.

Section heading: "${heading}"
Section type: "${sectionType}"
Section content: "${summary.slice(0, 400)}"

DESIGN APPROACH — choose ONE scene type:

  FLOW DIAGRAM
    Left-to-right sequence of 3–5 steps connected by horizontal lines or arrows. Each step: a rounded rect (rx="6"), a simple icon inside, and a SHORT UPPERCASE label below (font-size="7" or "8"). Add one dashed "problem path" above with a circle+X mark.
    Use when: process, pipeline, integration, workflow.

  CONTRAST SPLIT
    Two vertical panels side by side. Left: simpler state (before/promise). Right: complex or broken state (after/reality). Label each panel at top in uppercase.
    Use when: before/after, expectation vs outcome, demo vs production.

  RISK CALLOUT
    A large central warning triangle with ! inside. Surround with 2–3 small labeled elements radiating outward.
    Use when: risk, failure mode, unreliability.

  NETWORK MAP
    3–5 circles (nodes) connected by lines. One central hub, others orbiting. Label each node. One dashed connection.
    Use when: integration, ecosystem, platform, connectivity.

  GROWTH BARS
    4–5 vertical rect bars of increasing height. Add a horizontal threshold line above one bar in accent color.
    Use when: scaling, adoption curve, growth.

Canvas: viewBox="0 0 300 240" width="300" height="240"
The canvas is portrait-oriented (300 wide × 240 tall). Use the full height — spread elements vertically, not just in a horizontal strip.

SVG RULES (any violation causes retry):
- Allowed elements ONLY: svg, g, rect, circle, path, line, text, tspan
- Forbidden elements: image, use, defs, clipPath, filter, linearGradient, radialGradient, symbol, pattern, foreignObject
- Text: font-family="monospace", font-size 8–11, UPPERCASE only, max 14 chars per label, max 10 text elements total
- Allowed colors ONLY: #F7F5F2 #163D26 #185F00 #FFFFFF #F93943
- FORBIDDEN color: #F88379
- No opacity attributes, no rgba, no hsl, no named colors (only "none" allowed)
- Dashed lines: stroke-dasharray="5 3"
- First child of <svg>: <rect width="300" height="240" fill="#F7F5F2"/>
- Main color: #163D26. Secondary: #185F00. Accent (use sparingly, ONE element only): #F93943. Icons on dark: #FFFFFF
- 10–40 elements total, 10px margin from all edges

Call the create_svg tool with the complete SVG markup string.`;
}

// ── Tool definition forces Claude to output SVG as structured JSON ────────────
const SVG_TOOL = {
  name: "create_svg",
  description: "Output the completed SVG illustration markup.",
  input_schema: {
    type: "object" as const,
    properties: {
      svg: {
        type: "string",
        description: "The complete SVG markup, starting with <svg ...> and ending with </svg>.",
      },
    },
    required: ["svg"],
  },
};

const CLAUDE_MODEL = "claude-sonnet-5";

async function callClaude(prompt: string): Promise<{ svg: string | null; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: "You are an editorial SVG diagram designer for a B2B AI publication. You always call the create_svg tool with the complete SVG markup. Never add explanatory text.",
      tools: [SVG_TOOL],
      // Force Claude to always call this tool — no free-text response possible
      tool_choice: { type: "tool", name: "create_svg" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; name?: string; input?: { svg?: string }; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  // Extract SVG from the tool_use block
  const toolBlock = data.content?.find(b => b.type === "tool_use" && b.name === "create_svg");
  const svg = toolBlock?.input?.svg?.trim() ?? null;

  return {
    svg,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireUser();
  if (authError) return authError;

  const budget = await checkBudget(user.id);
  if (!budget.allowed) {
    return NextResponse.json({ svgString: null }, { status: 429 });
  }

  try {
    const { heading, sectionType, summary } = (await req.json()) as {
      heading?: string;
      sectionType?: string;
      summary?: string;
    };

    if (!heading) {
      return NextResponse.json({ error: "heading required" }, { status: 400 });
    }

    const prompt = buildPrompt(heading ?? "", sectionType ?? "section", summary ?? "");

    for (let attempt = 0; attempt < 3; attempt++) {
      const { svg, inputTokens, outputTokens } = await callClaude(prompt);
      logAiUsage({ userId: user.id, feature: "illustration-claude", model: CLAUDE_MODEL, inputTokens, outputTokens });

      if (!svg) {
        console.warn(`[illustration-claude] Attempt ${attempt + 1}: no svg in tool response`);
        continue;
      }

      // Ensure it's a complete SVG block
      if (!svg.includes("<svg") || !svg.includes("</svg>")) {
        console.warn(`[illustration-claude] Attempt ${attempt + 1}: incomplete svg block`);
        continue;
      }

      const { valid, reason } = validateSvg(svg);
      if (valid) {
        return NextResponse.json({ svgString: svg });
      }
      console.warn(`[illustration-claude] Attempt ${attempt + 1} failed validation: ${reason}`);
    }

    return NextResponse.json({ svgString: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[illustration-claude]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

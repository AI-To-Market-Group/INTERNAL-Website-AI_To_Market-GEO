import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { logAiUsage } from "@/lib/ai-usage-logger";

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
  // light surface — coral forbidden
  if (hasCoral) return { valid: false, reason: "Coral forbidden on light surface" };
  return { valid: true };
}

function buildPrompt(heading: string, sectionType: string, summary: string): string {
  return `You are designing an editorial illustration for a B2B AI article. Create a small readable SVG scene that shows the section's core story as a narrative diagram.

Section heading: "${heading}"
Section type: "${sectionType}"
Section content: "${summary.slice(0, 400)}"

DESIGN APPROACH — choose ONE of these scene types:

  FLOW DIAGRAM
    Left-to-right sequence of 3–5 steps connected by horizontal lines or arrows. Each step: a rounded rect (rx="6"), a simple icon inside (built from rect/circle/path), and a SHORT UPPERCASE label below (font-size="7" or "8"). Add one "problem path" above the main flow: a short dashed line (stroke-dasharray="5 3") with a circle+X mark.
    Use when: process, pipeline, integration, workflow, step-by-step.

  CONTRAST SPLIT
    Two vertical panels side by side. Left panel: simpler content (before, promise). Right panel: more complex or broken content (after, reality). Label each panel at the top in uppercase.
    Use when: before/after, expectation vs outcome, demo vs production.

  RISK CALLOUT
    A large central warning triangle with an exclamation mark inside. Surround it with 2–3 small labeled elements showing causes or consequences radiating outward.
    Use when: risk, failure mode, unreliability, something that breaks.

  NETWORK MAP
    3–5 circles (nodes) connected by lines. One central hub node, others orbiting. Label each node. One connection shown as dashed.
    Use when: integration, ecosystem, platform, connectivity.

  GROWTH BARS
    4–5 vertical rect bars of increasing height, abstract bar chart silhouette. Add a horizontal threshold line above one bar in the accent color.
    Use when: scaling, adoption curve, growth, increasing volume.

Canvas: viewBox="0 0 340 130" width="340" height="130"

ABSOLUTE RULES — any violation causes immediate rejection:
1. Output ONLY raw SVG markup. No markdown, no code fences, no explanation, no comments.
2. Opening tag must be exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 130" width="340" height="130">
3. Closing tag: </svg>
4. Allowed elements: svg, g, rect, circle, path, line, text, tspan — nothing else.
   Forbidden: image, use, defs, clipPath, filter, linearGradient, radialGradient, symbol, pattern, foreignObject.
5. Text rules: font-family="monospace" only. font-size between "7" and "10". fill must be a palette color. Keep all text UPPERCASE. Labels max 12 characters. No more than 8 text elements total.
6. Allowed fill/stroke colors (exact 6-digit hex): #F7F5F2, #163D26, #185F00, #FFFFFF, #F93943
7. FORBIDDEN color: #F88379 — must never appear anywhere.
8. First element inside <svg> must be <rect width="340" height="130" fill="#F7F5F2"/> as the background.
9. Use #F93943 sparingly — for ONE focal element: a problem indicator, a key node, a threshold line, or a warning mark.
10. Main structural color: #163D26. Use #185F00 for secondary fills. White (#FFFFFF) for icon details on dark cards.
11. No opacity, fill-opacity, stroke-opacity, rgba, hsl, or named colors ("none" is allowed for fill/stroke).
12. For dashed lines: stroke-dasharray="5 3" on a <line> or <path> element.
13. 10–35 elements total. Clear 8px margins from all four edges.
14. Surface: LIGHT. Background is already set — do not add a second background rect.`;
}

function extractSvgBlock(raw: string): string | null {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  return match ? match[0] : null;
}

const CLAUDE_MODEL = "claude-sonnet-5";

async function callClaude(prompt: string): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
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
      max_tokens: 3500,
      system: "You are an editorial SVG diagram designer for a B2B AI publication. You create clean narrative scene diagrams as raw SVG — no markdown, no explanation, no code fences. Use monospace text labels, simple flat icons built from rect/circle/path, and a structured layout.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    text: (data.content?.find(b => b.type === "text")?.text ?? "").trim(),
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireUser();
  if (authError) return authError;

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

    for (let attempt = 0; attempt < 2; attempt++) {
      const { text: raw, inputTokens, outputTokens } = await callClaude(prompt);
      logAiUsage({ userId: user.id, feature: "illustration-claude", model: CLAUDE_MODEL, inputTokens, outputTokens });
      const svg = extractSvgBlock(raw);
      if (!svg) {
        console.warn(`[illustration-claude] Attempt ${attempt + 1}: no <svg> block`);
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

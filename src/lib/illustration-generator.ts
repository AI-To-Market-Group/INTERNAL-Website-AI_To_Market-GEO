import sharp from "sharp";
import { logAiUsage } from "@/lib/ai-usage-logger";

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  "#F7F5F2", // off-white  — light surface bg
  "#163D26", // dark green — dark surface bg
  "#185F00", // mid green  — structural / fill
  "#FFFFFF", // white      — detail / contrast
  "#F93943", // red        — accent on LIGHT surfaces only
  "#F88379", // coral      — accent on DARK  surfaces only
] as const;

type PaletteHex = (typeof PALETTE)[number];

const PALETTE_UPPER = new Set(PALETTE.map((h) => h.toUpperCase()));
const RED   = "#F93943";
const CORAL = "#F88379";

export type IllustrationSurface = "light" | "dark";

export interface SanityImageRef {
  _type: "image";
  asset: { _type: "reference"; _ref: string };
}

// ── Colour extraction & validation ────────────────────────────────────────────

function extractColors(svg: string): string[] {
  const found: string[] = [];
  // Match both fill="#..." and stroke="#..." (6-digit hex only)
  const re = /(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    found.push(m[1].toUpperCase());
  }
  return found;
}

function validateSvg(
  svg: string,
  surface: IllustrationSurface
): { valid: boolean; reason?: string } {
  const colors = extractColors(svg);

  for (const color of colors) {
    if (!PALETTE_UPPER.has(color)) {
      return { valid: false, reason: `Off-palette color: ${color}` };
    }
  }

  const hasRed   = colors.includes(RED.toUpperCase());
  const hasCoral = colors.includes(CORAL.toUpperCase());

  if (hasRed && hasCoral) {
    return { valid: false, reason: "Both red and coral used — only one accent allowed per surface" };
  }
  if (surface === "light" && hasCoral) {
    return { valid: false, reason: `Coral (${CORAL}) is forbidden on light surfaces` };
  }
  if (surface === "dark" && hasRed) {
    return { valid: false, reason: `Red (${RED}) is forbidden on dark surfaces` };
  }

  return { valid: true };
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(title: string, summary: string, surface: IllustrationSurface): string {
  const bg     = surface === "light" ? "#F7F5F2" : "#163D26";
  const fg     = surface === "light" ? "#163D26" : "#F7F5F2";
  const accent = surface === "light" ? RED : CORAL;
  const banned = surface === "light" ? CORAL : RED;
  const mid    = "#185F00";
  const allowed = PALETTE.filter((h) => h !== banned).join(", ");

  return `You are designing an editorial illustration for a B2B AI article. Create a small readable SVG scene that shows the article's core story — the conflict, flow, or concept — as a narrative diagram.

Title: "${title}"
Article sections: "${summary}"

DESIGN APPROACH — read the article story, then choose ONE of these scene types:

  FLOW DIAGRAM
    Left-to-right sequence of 3–5 steps connected by horizontal lines or arrows (use a path with
    a small arrowhead). Each step: a rounded rect (rx="6") as a card, a simple icon inside
    (built from rect/circle/path), and a SHORT UPPERCASE label below (font-size="7" or "8").
    Add one "problem path" above the main flow: a short dashed line (stroke-dasharray="5 3")
    with a circle+X mark to show a shortcut or failure point.
    Use when: process, pipeline, integration, agent workflow, step-by-step adoption.

  CONTRAST SPLIT
    Two vertical panels side by side with a thin gap. Left panel: simpler content (demo, before,
    promise). Right panel: more complex or broken content (production, after, reality).
    Label each panel at the top in uppercase. Inside each panel draw 2–3 small horizontal lines
    or icons to show content density. Make right panel visually busier or show a warning mark.
    Use when: demo vs production, vendor claim vs reality, before/after, expectation vs outcome.

  RISK CALLOUT
    A large central warning triangle (path forming equilateral triangle, no fill, thick stroke)
    with an exclamation mark inside. Surround it with 2–3 small labeled elements showing the
    causes or consequences radiating outward from the triangle.
    Use when: general risk, failure mode, unreliability, hallucination, something that breaks.

  NETWORK MAP
    3–5 circles (nodes) connected by lines. One central hub node, others orbiting. Label each
    node. One connection shown as dashed to indicate a problem or missing link.
    Use when: integration, ecosystem, platform, connectivity, missing piece.

  GROWTH BARS
    4–5 vertical rect bars of increasing height left to right, like a bar chart silhouette but
    abstract — no axes, no numbers, just the shape. Add a horizontal threshold line above one
    bar in the accent color.
    Use when: scaling, adoption curve, growth, increasing volume, maturity.

Canvas: viewBox="0 0 340 130" width="340" height="130" — wider canvas to fit a scene.

ABSOLUTE RULES — any violation causes immediate rejection:

1. Output ONLY raw SVG markup. No markdown, no code fences, no explanation, no comments.
2. Opening tag must be exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 130" width="340" height="130">
3. Closing tag: </svg>
4. Allowed elements: svg, g, rect, circle, path, line, text, tspan — nothing else.
   Forbidden: image, use, defs, clipPath, filter, linearGradient, radialGradient, symbol, pattern, foreignObject.
5. Text rules: font-family="monospace" only. font-size between "7" and "10". fill must be a palette color.
   Keep all text UPPERCASE. Labels max 12 characters. No more than 8 text elements total.
6. Allowed fill/stroke colors (exact 6-digit hex, case-insensitive): ${allowed}
7. FORBIDDEN color: ${banned} — must never appear anywhere.
8. First element inside <svg> must be <rect width="340" height="130" fill="${bg}"/> as the background.
9. Use ${accent} sparingly — for ONE focal element: a problem indicator, a key node, a threshold line, or a warning mark.
10. Main structural color: ${fg}. Use ${mid} for secondary fills (card backgrounds, inactive nodes).
    White (#FFFFFF) for icon details on dark cards.
11. No opacity, fill-opacity, stroke-opacity, rgba, hsl, or named colors ("none" is allowed for fill/stroke).
12. For dashed lines: stroke-dasharray="5 3" on a <line> or <path> element.
13. 10–35 elements total. Clear 8px margins from all four edges.
14. Surface: ${surface.toUpperCase()}. Background is already set — do not add a second background rect.`;
}

// ── OpenAI call (raw fetch — same pattern as openai-article.ts) ───────────────

const ILLUSTRATION_MODEL = "gpt-4o";

async function callGpt4o(
  prompt: string,
  temperature: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ILLUSTRATION_MODEL,
      temperature,
      max_tokens: 3500,
      messages: [
        {
          role: "system",
          content: "You are an editorial SVG diagram designer for a B2B AI publication. You create clean narrative scene diagrams as raw SVG — no markdown, no explanation, no code fences. Use monospace text labels, simple flat icons built from rect/circle/path, and a structured layout that tells the article's story.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    content: (data.choices?.[0]?.message?.content ?? "").trim(),
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function extractSvgBlock(raw: string): string | null {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  return match ? match[0] : null;
}

function ensureDimensions(svg: string): string {
  if (!svg.includes("width=") || !svg.includes("height=")) {
    return svg.replace("<svg", '<svg width="340" height="130"');
  }
  return svg;
}

// ── Public: generate SVG string only (for preview / testing) ─────────────────

export async function generateIllustrationSvg(
  title: string,
  summary: string,
  surface: IllustrationSurface,
  userId?: string
): Promise<string | null> {
  const temperatures = [0.8, 0.3];

  for (let attempt = 0; attempt < 2; attempt++) {
    const { content: raw, inputTokens, outputTokens } = await callGpt4o(
      buildPrompt(title, summary, surface),
      temperatures[attempt]
    );
    if (userId) {
      logAiUsage({ userId, feature: "illustration", model: ILLUSTRATION_MODEL, inputTokens, outputTokens });
    }
    const svg = extractSvgBlock(raw);

    if (!svg) {
      console.warn(`[illustration] Attempt ${attempt + 1}: no <svg> block found in response`);
      continue;
    }

    const { valid, reason } = validateSvg(svg, surface);
    if (valid) {
      return ensureDimensions(svg);
    }

    console.warn(`[illustration] Attempt ${attempt + 1} failed validation: ${reason}`);
  }

  console.error("[illustration] Both attempts failed — returning null");
  return null;
}

// ── Public: full pipeline → SVG → PNG → Sanity asset → ref ───────────────────

export async function generateIllustration(
  title: string,
  summary: string,
  surface: IllustrationSurface,
  userId?: string
): Promise<SanityImageRef | null> {
  const svg = await generateIllustrationSvg(title, summary, surface, userId);
  if (!svg) return null;

  // Rasterize SVG to PNG at 2× density (→ 340×260 px output)
  const png = await sharp(Buffer.from(svg), { density: 144 })
    .png()
    .toBuffer();

  // Upload to Sanity image asset store
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset   = process.env.SANITY_DATASET    ?? "production";
  const token     = process.env.SANITY_API_TOKEN;
  const apiVer    = process.env.SANITY_API_VERSION ?? "2024-01-01";

  if (!projectId || !token) {
    throw new Error("Sanity not configured — set SANITY_PROJECT_ID and SANITY_API_TOKEN");
  }

  const uploadRes = await fetch(
    `https://${projectId}.api.sanity.io/v${apiVer}/assets/images/${dataset}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        Authorization: `Bearer ${token}`,
      },
      body: png as unknown as BodyInit,
    }
  );

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Sanity asset upload failed (${uploadRes.status}): ${text}`);
  }

  const { document: asset } = (await uploadRes.json()) as {
    document: { _id: string };
  };

  if (!asset?._id) throw new Error("No _id returned from Sanity asset upload");

  return {
    _type: "image",
    asset: { _type: "reference", _ref: asset._id },
  };
}

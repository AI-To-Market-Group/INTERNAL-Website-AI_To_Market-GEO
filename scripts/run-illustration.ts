import { generateIllustrationSvg } from "../src/lib/illustration-generator";

const PALETTE_UPPER = new Set([
  "#F7F5F2","#163D26","#185F00","#FFFFFF","#F93943","#F88379"
].map(h => h.toUpperCase()));

function extractColors(svg: string) {
  const found: string[] = [];
  const re = /(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) found.push(m[1].toUpperCase());
  return [...new Set(found)];
}

async function run(title: string, summary: string, surface: "light" | "dark") {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Title:   "${title}"`);
  console.log(`Summary: "${summary}"`);
  console.log(`Surface: ${surface.toUpperCase()}`);
  console.log("─".repeat(60));

  const warns: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args) => { warns.push(args.join(" ")); origWarn(...args); };

  const svg = await generateIllustrationSvg(title, summary, surface);

  console.warn = origWarn;

  if (warns.length) {
    console.log("\n⚠  Validator rejections:");
    warns.forEach(w => console.log("   " + w));
  } else {
    console.log("\n✓  Passed validation on first attempt");
  }

  if (!svg) { console.log("\n✗  Both attempts failed."); return null; }

  const colors = extractColors(svg);
  const allValid = colors.every(c => PALETTE_UPPER.has(c));

  console.log("\n── Colors ───────────────────────────────────────────");
  console.log("Found:", colors.join("  "));
  console.log("All on-palette:", allValid ? "YES ✓" : "NO ✗");

  console.log("\n── SVG ──────────────────────────────────────────────");
  console.log(svg);

  return svg;
}

(async () => {
  // Test: broken AI-to-CRM connection (mock-gap-2 concept)
  const lightSvg = await run(
    "AI for B2B sales teams: what actually works vs vendor promises",
    "AI sales tools often fail to maintain a reliable integration with CRM systems, leaving teams with duplicated data and a costly gap in their workflow.",
    "light"
  );

  if (lightSvg) process.stdout.write("\n[LIGHT_SVG_START]" + lightSvg + "[LIGHT_SVG_END]\n");
})();

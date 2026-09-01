/**
 * Full end-to-end illustration pipeline test.
 * 1. GPT-4o → SVG (with colour validation)
 * 2. sharp → PNG rasterised at 2× density
 * 3. Saves PNG locally to ./pipeline-output/ for inspection
 * 4. Uploads PNG to Sanity image asset store
 * 5. Prints the Sanity asset _ref
 */
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { generateIllustrationSvg, type IllustrationSurface } from "../src/lib/illustration-generator";

const OUT_DIR = path.resolve(__dirname, "../pipeline-output");

async function runFull(title: string, summary: string, surface: IllustrationSurface) {
  console.log(`\n${"─".repeat(64)}`);
  console.log(`TITLE:   "${title}"`);
  console.log(`SUMMARY: "${summary}"`);
  console.log(`SURFACE: ${surface.toUpperCase()}`);
  console.log("─".repeat(64));

  // ── Stage 1: GPT-4o → validated SVG ──────────────────────────────
  const warns: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args) => { warns.push(args.join(" ")); origWarn(...args); };

  console.log("\n[1/4] Calling GPT-4o…");
  const svg = await generateIllustrationSvg(title, summary, surface);

  console.warn = origWarn;

  if (warns.length) {
    console.log("  ⚠  Validator rejected attempt 1, retried:");
    warns.forEach(w => console.log("     " + w));
  } else {
    console.log("  ✓  Passed colour validation on first attempt");
  }

  if (!svg) {
    console.error("  ✗  Both attempts failed. Aborting.");
    return null;
  }

  // ── Stage 2: SVG → PNG (2× density = 340×260 px) ─────────────────
  console.log("\n[2/4] Rasterising SVG with sharp…");
  const png = await sharp(Buffer.from(svg), { density: 144 })
    .png()
    .toBuffer();

  const info = await sharp(png).metadata();
  console.log(`  ✓  PNG ready — ${info.width}×${info.height} px, ${png.length} bytes`);

  // ── Stage 3: Save PNG locally ──────────────────────────────────────
  console.log("\n[3/4] Saving PNG locally…");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const slug = title.toLowerCase().replace(/\s+/g, "-").slice(0, 40);
  const localPath = path.join(OUT_DIR, `${slug}-${surface}.png`);
  fs.writeFileSync(localPath, png);
  console.log(`  ✓  Saved → ${localPath}`);

  // ── Stage 4: Upload to Sanity ──────────────────────────────────────
  console.log("\n[4/4] Uploading to Sanity…");
  const projectId = process.env.SANITY_PROJECT_ID?.trim();
  const dataset   = process.env.SANITY_DATASET?.trim()      ?? "production";
  const token     = process.env.SANITY_API_TOKEN?.trim();
  const apiVer    = process.env.SANITY_API_VERSION?.trim()   ?? "2024-01-01";

  if (!projectId || !token) {
    console.error("  ✗  Missing SANITY_PROJECT_ID or SANITY_API_TOKEN in .env — skipping upload.");
    return { localPath, sanityRef: null };
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
    console.error(`  ✗  Sanity upload failed (${uploadRes.status}): ${text}`);
    return { localPath, sanityRef: null };
  }

  const { document: asset } = (await uploadRes.json()) as { document: { _id: string; url: string } };
  console.log(`  ✓  Uploaded → asset._id: ${asset._id}`);
  console.log(`     CDN URL: ${asset.url}`);

  const ref = {
    _type: "image" as const,
    asset: { _type: "reference" as const, _ref: asset._id },
  };

  return { localPath, sanityRef: ref, cdnUrl: asset.url };
}

(async () => {
  const result = await runFull(
    "AI for B2B sales teams: what actually works vs vendor promises",
    "AI sales tools often fail to maintain a reliable integration with CRM systems, leaving teams with duplicated data and a costly gap in their workflow.",
    "light"
  );

  console.log("\n" + "═".repeat(64));
  console.log("RESULT SUMMARY");
  console.log("═".repeat(64));
  if (result) {
    console.log("Local PNG :", result.localPath);
    if (result.sanityRef) {
      console.log("Sanity ref:", JSON.stringify(result.sanityRef, null, 2));
      if ("cdnUrl" in result) console.log("CDN URL   :", result.cdnUrl);
    } else {
      console.log("Sanity    : upload skipped (missing env vars)");
    }
  } else {
    console.log("Pipeline failed — check errors above.");
  }
})();

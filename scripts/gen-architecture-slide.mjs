import pptxgen from "pptxgenjs";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

const VUSION_GREEN = "7BA05B";
const AITOM_BROWN = "A0522D";
const BG_CREAM = "FAF6E8";
const BG_ACCENT = "F5EFD7";
const TEXT_DARK = "1A1A1A";
const TEXT_WHITE = "FFFFFF";
const SECTION_BORDER = "2A2A2A";

const slide = pres.addSlide();
slide.background = { color: BG_CREAM };

slide.addShape("rect", {
  x: 0, y: 0, w: 4.5, h: 7.5,
  fill: { color: BG_ACCENT },
  line: { type: "none" }
});

slide.addText("Agent we are building", {
  x: 0.4, y: 0.25, w: 6, h: 0.7,
  fontFace: "Arial Black", fontSize: 28, bold: true, color: TEXT_DARK
});

slide.addText("Functional Architecture", {
  x: 7.5, y: 0.2, w: 5.5, h: 0.6,
  fontFace: "Georgia", fontSize: 26, color: TEXT_DARK, align: "right"
});

slide.addShape("rect", {
  x: 10.3, y: 0.95, w: 1.2, h: 0.35,
  fill: { color: VUSION_GREEN }, line: { type: "none" }
});
slide.addText("VUSION", {
  x: 10.3, y: 0.95, w: 1.2, h: 0.35,
  fontFace: "Arial", fontSize: 10, bold: true, color: TEXT_WHITE, align: "center", valign: "middle"
});
slide.addShape("rect", {
  x: 11.6, y: 0.95, w: 1.4, h: 0.35,
  fill: { color: AITOM_BROWN }, line: { type: "none" }
});
slide.addText("AI TO MARKET", {
  x: 11.6, y: 0.95, w: 1.4, h: 0.35,
  fontFace: "Arial", fontSize: 10, bold: true, color: TEXT_WHITE, align: "center", valign: "middle"
});

const sectionX = 0.5;
const sectionW = 12.3;

// DATA & INFRASTRUCTURE
const dataY = 1.5;
const dataH = 1.3;
slide.addShape("rect", {
  x: sectionX, y: dataY, w: sectionW, h: dataH,
  fill: { color: BG_CREAM }, line: { color: SECTION_BORDER, width: 1.25 }
});
slide.addText("DATA & INFRASTRUCTURE", {
  x: sectionX + 0.15, y: dataY + 0.08, w: 4, h: 0.3,
  fontFace: "Arial", fontSize: 12, bold: true, color: TEXT_DARK
});

const dataBoxes = [
  { label: "Supabase", desc: "Postgres + pgvector\nAuth (2-3 users)", color: AITOM_BROWN },
  { label: "SEMrush API", desc: "SEO + SERP\nPer-country data", color: VUSION_GREEN },
  { label: "Brand Assets", desc: "ToV · Guidelines\nGlossary · Inspirations", color: VUSION_GREEN },
];
const dataBoxW = 2.4;
const dataBoxGap = 0.3;
const dataBoxesTotalW = dataBoxes.length * dataBoxW + (dataBoxes.length - 1) * dataBoxGap;
const dataBoxStartX = sectionX + (sectionW - dataBoxesTotalW) / 2;
dataBoxes.forEach((b, i) => {
  const x = dataBoxStartX + i * (dataBoxW + dataBoxGap);
  slide.addShape("roundRect", {
    x, y: dataY + 0.45, w: dataBoxW, h: 0.75,
    fill: { color: b.color }, line: { type: "none" }, rectRadius: 0.08
  });
  slide.addText([
    { text: b.label + "\n", options: { fontSize: 12, bold: true, color: TEXT_WHITE } },
    { text: b.desc, options: { fontSize: 9, color: TEXT_WHITE } }
  ], {
    x, y: dataY + 0.45, w: dataBoxW, h: 0.75,
    fontFace: "Arial", align: "center", valign: "middle"
  });
});

// arrow down
slide.addShape("rightTriangle", {
  x: sectionX + sectionW / 2 - 0.1, y: dataY + dataH + 0.05, w: 0.2, h: 0.15,
  fill: { color: TEXT_DARK }, line: { type: "none" }, flipV: true, rotate: 90
});
slide.addShape("line", {
  x: sectionX + sectionW / 2, y: dataY + dataH, w: 0, h: 0.15,
  line: { color: TEXT_DARK, width: 1.5 }
});

// ORCHESTRATION
const orchY = 3.0;
const orchH = 2.6;
slide.addShape("rect", {
  x: sectionX, y: orchY, w: sectionW, h: orchH,
  fill: { color: BG_CREAM }, line: { color: SECTION_BORDER, width: 1.25 }
});
slide.addText("ORCHESTRATION", {
  x: sectionX + 0.15, y: orchY + 0.08, w: 4, h: 0.3,
  fontFace: "Arial", fontSize: 12, bold: true, color: TEXT_DARK
});

slide.addShape("rect", {
  x: sectionX + 0.4, y: orchY + 0.5, w: sectionW - 0.8, h: 1.95,
  fill: { type: "none" }, line: { color: TEXT_DARK, width: 1, dashType: "dash" }
});
slide.addShape("roundRect", {
  x: sectionX + 0.6, y: orchY + 0.38, w: 2.4, h: 0.3,
  fill: { color: "B8D4E8" }, line: { type: "none" }, rectRadius: 0.04
});
slide.addText("Agent Orchestration — Next.js", {
  x: sectionX + 0.6, y: orchY + 0.38, w: 2.4, h: 0.3,
  fontFace: "Arial", fontSize: 9, bold: true, color: TEXT_DARK, align: "center", valign: "middle"
});

const orchBoxes = [
  { label: "Brief +\nWorkflow", desc: "Ingestion +\nbusiness rules", color: AITOM_BROWN },
  { label: "RAG Retrieval", desc: "pgvector\nBrand chunks\n(Supabase)", color: AITOM_BROWN },
  { label: "AI Generation", desc: "Claude +\nPerplexity\nPer-country", color: AITOM_BROWN },
  { label: "Quality Gate", desc: "SEO · GEO\nBrand · Compliance\nHITL if low conf.", color: AITOM_BROWN },
  { label: "Frontend", desc: "Vercel by AITOM\nNext.js Dashboard\nReview · Edit", color: AITOM_BROWN },
];
const orchBoxW = 2.2;
const orchBoxGap = 0.15;
const orchBoxesTotalW = orchBoxes.length * orchBoxW + (orchBoxes.length - 1) * orchBoxGap;
const orchBoxStartX = sectionX + (sectionW - orchBoxesTotalW) / 2;
const orchBoxY = orchY + 0.9;
const orchBoxH = 1.4;
orchBoxes.forEach((b, i) => {
  const x = orchBoxStartX + i * (orchBoxW + orchBoxGap);
  slide.addShape("roundRect", {
    x, y: orchBoxY, w: orchBoxW, h: orchBoxH,
    fill: { color: b.color }, line: { type: "none" }, rectRadius: 0.1
  });
  slide.addText([
    { text: b.label + "\n", options: { fontSize: 12, bold: true, color: TEXT_WHITE } },
    { text: b.desc, options: { fontSize: 9, color: TEXT_WHITE } }
  ], {
    x, y: orchBoxY, w: orchBoxW, h: orchBoxH,
    fontFace: "Arial", align: "center", valign: "middle"
  });
  if (i < orchBoxes.length - 1) {
    const arrowX = x + orchBoxW + 0.005;
    const arrowY = orchBoxY + orchBoxH / 2 - 0.07;
    slide.addShape("rightTriangle", {
      x: arrowX, y: arrowY, w: 0.14, h: 0.14,
      fill: { color: TEXT_DARK }, line: { type: "none" }, rotate: 90
    });
  }
});

// arrow down to OUTPUT
slide.addShape("line", {
  x: sectionX + sectionW / 2, y: orchY + orchH, w: 0, h: 0.2,
  line: { color: TEXT_DARK, width: 1.5 }
});
slide.addShape("rightTriangle", {
  x: sectionX + sectionW / 2 - 0.1, y: orchY + orchH + 0.18, w: 0.2, h: 0.15,
  fill: { color: TEXT_DARK }, line: { type: "none" }, rotate: 180
});

// OUTPUT
const outY = 5.95;
const outH = 1.1;
slide.addShape("rect", {
  x: sectionX, y: outY, w: sectionW, h: outH,
  fill: { color: BG_CREAM }, line: { color: SECTION_BORDER, width: 1.25 }
});
slide.addText("Output", {
  x: sectionX + 0.15, y: outY + 0.08, w: 2, h: 0.3,
  fontFace: "Arial", fontSize: 12, bold: true, color: TEXT_DARK
});

const outputBoxes = [
  { label: "Versioned Content", desc: "Supabase — draft / approved\nExport MD · HTML · DOCX", color: AITOM_BROWN },
  { label: "Dashboard Review", desc: "HITL · Findings panel\nDeprecate stale chunks", color: VUSION_GREEN },
];
const outBoxW = 4.0;
const outBoxGap = 0.4;
const outBoxesTotalW = outputBoxes.length * outBoxW + (outputBoxes.length - 1) * outBoxGap;
const outBoxStartX = sectionX + (sectionW - outBoxesTotalW) / 2;
outputBoxes.forEach((b, i) => {
  const x = outBoxStartX + i * (outBoxW + outBoxGap);
  slide.addShape("roundRect", {
    x, y: outY + 0.3, w: outBoxW, h: 0.65,
    fill: { color: b.color }, line: { type: "none" }, rectRadius: 0.08
  });
  slide.addText([
    { text: b.label + "  —  ", options: { fontSize: 11, bold: true, color: TEXT_WHITE } },
    { text: b.desc, options: { fontSize: 9, color: TEXT_WHITE } }
  ], {
    x, y: outY + 0.3, w: outBoxW, h: 0.65,
    fontFace: "Arial", align: "center", valign: "middle"
  });
});

slide.addText("4", {
  x: 12.7, y: 7.1, w: 0.4, h: 0.3,
  fontFace: "Arial", fontSize: 11, color: "666666", align: "right"
});

const outPath = "C:/Users/ayman/Desktop/AITM_GEO/vusion-agent-content_creation/docs/vusion-content-creation-architecture.pptx";
await pres.writeFile({ fileName: outPath });
console.log("Wrote:", outPath);

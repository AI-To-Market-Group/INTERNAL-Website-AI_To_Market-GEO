/**
 * GEO Score
 *
 * Detects five signals that indicate an article will be cited by AI search engines.
 * Word count is measured and returned separately — it is informational, not a scored check.
 *
 * Sync signals (detectGeoScoreSignals):
 *   1. Named sources       — cites specific organisations/people, not just "studies show"
 *   2. Statistics + sources — quantitative claims tied to a named attribution within 80 chars
 *   3. Quotations          — attributed expert quotes or substantive quoted text
 *   4. Fluency anchors     — 1–3 GEO anchor phrases (In summary, Bottom line, etc.)
 *
 * Async signal (checkFanOutCoverage):
 *   5. FAQ fan-out         — GPT-4o generates 3–5 follow-up questions; ≥60% must be addressed
 *
 * computeGeoScore(text, topic) runs both in parallel and returns { score, checks, wordCount }.
 */

import type { GeoCheck, GeoScore, GenerateArticleResponse } from "@/types";

export type { GeoCheck, GeoScore };

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── 1. Named sources ──────────────────────────────────────────────────────────
// Passes when ≥2 explicit named attributions are present and generic phrases
// don't outnumber the named ones (i.e. generic phrases are the minority).

const GENERIC_ATTRIBUTION_RE = /\b(studies show|research shows?|experts say|industry data|according to research)\b/gi;

// Matches: "according to McKinsey", "per Vision Council 2024", "— Gartner",
// "McKinsey (2024)", "MIT Sloan (2024)", "Harvard Business Review (2023)",
// "(Pew Research Center, 2024)", "(Bain, 2024)"  ← parenthesised inline citation format
// "per Microsoft and LinkedIn (2024)" — lookahead now accepts \s*\(\d{4}\) as valid terminator
const NAMED_SOURCE_RE =
  /\b(?:according to|per|cited by|reported by)\s+[A-Z][A-Za-z\s&.]+?(?=,|\.|\s\d{4}|\s—|\n|$|\s*\((?:19|20)\d{2}\))|—\s*[A-Z][A-Za-z\s]+(?:\d{4})?|[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?\s(?:19|20)\d{2}|[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\s*\((?:19|20)\d{2}\)|\([A-Z][A-Za-z\s&.]+,\s*(?:19|20)\d{2}\)/g;

function checkNamedSources(text: string): GeoCheck {
  const namedMatches = [...text.matchAll(NAMED_SOURCE_RE)]
    .map((m) => m[0].trim())
    .filter((m) => m.length > 3)
    .slice(0, 5);
  const genericCount = (text.match(GENERIC_ATTRIBUTION_RE) ?? []).length;
  const pass = namedMatches.length >= 2 && genericCount <= namedMatches.length;

  return {
    label: "Named sources",
    pass,
    evidence:
      namedMatches.length > 0
        ? namedMatches.slice(0, 2).join("; ")
        : genericCount > 0
        ? "Only generic attribution (studies show, research shows…)"
        : "No source attribution found",
  };
}

// ── 2. Statistics paired with sources ─────────────────────────────────────────
// Passes when ≥2 numeric stats each co-occur with a source word in the same
// sentence or one immediately adjacent. Sentence-boundary detection replaces the
// old character window, which allowed a source two paragraphs away to satisfy
// the check if the raw character distance happened to be short.
//
// "per" alone is excluded from SOURCE_WORD_RE: "per quarter", "per store", "per user"
// would all false-positive. Instead, PER_NAMED_SOURCE_RE matches "per [CapitalLetter…]"
// which is always a named-source attribution ("per Microsoft", "per Stanford HAI").

// Matches: N% | N percent | N trillion/billion/million/thousand | Nx | twice/double/triple/N times
const STAT_RE =
  /\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*percent\b|\b\d+(?:\.\d+)?\s*(?:trillion|billion|million|thousand)\b|\b\d+(?:\.\d+)?[xX]\b|\b(?:twice|double|triple|(?:two|three|four|five|six|seven|eight|nine|ten)\s+times)\b/gi;
const SOURCE_WORD_RE =
  /\b(?:study|studies|research|report|survey|according|source|cited|data|gartner|mckinsey|gong|forrester|idc|deloitte|accenture|salesforce|openai|anthropic|vision council|nielsen|harvard|mit sloan|bain|bcg|pwc|kpmg|microsoft|linkedin|stanford|google|meta|ibm|oracle|hubspot)\b/gi;
// Catches "per Microsoft", "per Stanford HAI" etc. without catching "per quarter"
const PER_NAMED_SOURCE_RE = /\bper\s+[A-Z][A-Za-z]/g;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z\d])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function checkStatisticsWithSources(text: string): GeoCheck {
  const sentences = splitSentences(text);
  const evidence: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const statMatches = [...sentences[i].matchAll(new RegExp(STAT_RE.source, "gi"))];
    if (statMatches.length === 0) continue;

    // Source word must appear in the same sentence or one immediately adjacent
    const neighbourhood = [
      sentences[i - 1] ?? "",
      sentences[i],
      sentences[i + 1] ?? "",
    ].join(" ");

    SOURCE_WORD_RE.lastIndex = 0;
    PER_NAMED_SOURCE_RE.lastIndex = 0;
    if (SOURCE_WORD_RE.test(neighbourhood) || PER_NAMED_SOURCE_RE.test(neighbourhood)) {
      for (const m of statMatches) {
        evidence.push(`${m[0].trim()} [sourced]`);
      }
    }
  }

  const pass = evidence.length >= 2;
  return {
    label: "Statistics with sources",
    pass,
    evidence: pass
      ? evidence.slice(0, 3).join("; ")
      : `${evidence.length} sourced stat(s) found (need ≥ 2)`,
  };
}

// ── 3. Cited claims ───────────────────────────────────────────────────────────
// Passes when the text contains at least one of:
//   a) em-dash attribution  — Source, Year
//   b) substantive quoted passage (≥30 chars) with attribution nearby
//   c) inline attribution phrase: "according to Source, Year" or "per Source, Year"
//      These are all equivalent GEO citation signals for AI retrieval.

const DASH_ATTRIBUTION_RE = /—\s*[A-Z][A-Za-z\s,]+(?:\d{4})?/g;

// Matches ≥30-char quoted text in either curly ("…") or straight ("…") double
// quotes. Content exclusion [^"""] prevents spanning across multiple quotes.
const LONG_QUOTE_RE = /(?:"|")[^"""]{30,}(?:"|")/g;

// Attribution signal checked in an 80-char window around each quote match.
const NEAR_QUOTE_ATTRIBUTION_RE =
  /—\s*[A-Z][A-Za-z]|\b(?:according to|cited by|said|says|wrote|noted|states?)\s+[A-Z][A-Za-z]/;

// Inline attribution: "according to Bain, 2024" / "per Pew Research Center 2024"
// Year is optional — "according to McKinsey" also counts.
const INLINE_ATTRIBUTION_RE =
  /\b(?:according to|per|cited by|reported by)\s+[A-Z][A-Za-z\s&.]+(?:,\s*(?:19|20)\d{2})?/g;

function hasAttributionNear(text: string, start: number, end: number): boolean {
  const window = text.slice(Math.max(0, start - 80), Math.min(text.length, end + 80));
  return NEAR_QUOTE_ATTRIBUTION_RE.test(window);
}

function checkQuotations(text: string): GeoCheck {
  const dashes = [...text.matchAll(DASH_ATTRIBUTION_RE)].map((m) => m[0].trim());
  const longQuotes = [...text.matchAll(LONG_QUOTE_RE)]
    .filter((m) => hasAttributionNear(text, m.index!, m.index! + m[0].length))
    .map((m) => m[0].trim());
  const inlineAttributions = [...text.matchAll(INLINE_ATTRIBUTION_RE)].map((m) => m[0].trim());

  const all = [...dashes, ...longQuotes, ...inlineAttributions];
  const pass = all.length >= 1;

  return {
    label: "Cited claims",
    pass,
    evidence: pass
      ? (all[0].length > 80 ? all[0].slice(0, 80) + "..." : all[0])
      : 'No cited claims found (add "text" — Source or "according to Source")',
  };
}

// ── 4. AI-tell density ────────────────────────────────────────────────────────
// Five categories of AI-generated prose tells, scored as flagged instances per
// 1000 words. Fails when density exceeds 2.0/1000 — tolerates one genuine slip
// in a 900-word article (1.1/1000) but fails at two (2.2/1000), which is a
// pattern rather than an accident.
//
// Category 5 is detected structurally (section.heading vs first paragraph first
// sentence) when computeGeoScore receives the full GenerateArticleResponse.
// When only plain text is available (detectGeoScoreSignals standalone), a phrase
// proxy list is used instead. Known limitation: phrase proxy misses novel
// rephrasings of heading restatements; prefer the structural path when possible.

// Category 1: Significance inflation — asserting importance without making a claim
const SIGNIFICANCE_INFLATION = [
  "serves as a testament",
  "stands as a testament",
  "is a testament to",
  "marks a pivotal moment",
  "marks a significant shift",
  "represents a significant milestone",
  "underscores its importance",
  "underscores the importance of",
  "highlights the significance of",
  "highlights the need for",
  "reinforces the notion that",
  "demonstrates the value of",
  "emphasizes the need for",
  "speaks volumes",
  "paves the way for",
  "brings to light",
  "sheds light on",
  "serves as a reminder",
];

// Category 2: Dangling participials — comma-anchored trailing clauses that restate
// rather than extend. "suggesting" excluded: too many legitimate uses in analytical
// writing. Bare gerunds are not flagged; only the comma-attached trailing form.
const DANGLING_PARTICIPIAL_RE =
  /,\s*(?:highlighting|underscoring|reflecting|showcasing|demonstrating|emphasizing|illustrating|reinforcing|signaling)\b/gi;

// Category 3: Vague attribution — claims with no named source.
// Overlaps intentionally with GENERIC_ATTRIBUTION_RE in checkNamedSources:
// that check penalises vague attribution by reducing the named-source count;
// this check flags the same phrases directly as an AI tell.
const VAGUE_ATTRIBUTION = [
  "industry observers have noted",
  "industry observers note",
  "experts say",
  "experts note",
  "experts agree",
  "many experts",
  "thought leaders",
  "it is widely believed",
  "it is well known",
  "it is widely recognized",
  "the consensus is",
  "many believe",
  "analysts note",
  "analysts say",
];

// Category 4: Signposting — YouTube-script openers applied to written articles.
// Both contracted and expanded forms are listed: contracted for standalone use of
// detectGeoScoreSignals; expanded because brand-voice correction runs before this
// check in the main pipeline and will have already expanded the contractions.
const SIGNPOSTING = [
  "let's dive in",    "let us dive in",
  "let's dive into",  "let us dive into",
  "let's explore",    "let us explore",
  "let's take a look","let us take a look",
  "here's what you need to know",     "here is what you need to know",
  "here's everything you need to know","here is everything you need to know",
  "we'll cover",      "we will cover",
  "we'll explore",    "we will explore",
  "without further ado",
  "keep reading to",
  "read on to learn",
];

// Category 5 phrase proxy — formulaic restatement openers used when the structured
// GenerateArticleResponse is unavailable. See detectFragmentedHeaders() for the
// structural version.
const RESTATEMENT_OPENERS = [
  "this section covers",
  "this section explains",
  "this section will cover",
  "this section walks you through",
  "in this section, we",
  "in this section you'll",
  "in this section you will",
  "this article explores",
  "this article covers",
  "this guide covers",
  "this guide walks you through",
  "this piece covers",
  "this post covers",
];

// ── Structural fragmented-header detection ────────────────────────────────────
// Used by checkAiTellDensity when the full response is available.
// Flags sections where ≥50% of the meaningful heading words reappear in the
// first sentence of the first paragraph AND that sentence is ≤20 words —
// i.e. a short restatement rather than actual content.

const STOP_WORDS = new Set([
  "a","an","the","in","on","at","to","for","of","and","or","but",
  "is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might",
  "shall","can","with","from","by","as","this","that","these",
  "those","its","it","their","they","we","you","your","our",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function detectFragmentedHeaders(
  response: GenerateArticleResponse
): { count: number; samples: string[] } {
  const samples: string[] = [];

  for (const section of response.sections) {
    const heading = stripHtml(section.heading).trim();
    if (!heading) continue;

    const firstPara = section.content.paragraphs[0];
    if (!firstPara) continue;

    const firstSentence = stripHtml(firstPara.text).trim().split(/[.!?]/)[0].trim();
    if (!firstSentence) continue;

    const headingTokens = tokenize(heading);
    if (headingTokens.length === 0) continue;

    const sentenceTokenSet = new Set(tokenize(firstSentence));
    const overlap = headingTokens.filter((w) => sentenceTokenSet.has(w)).length;
    const sentenceWordCount = firstSentence.split(/\s+/).filter(Boolean).length;

    if (overlap >= 2 && overlap / headingTokens.length >= 0.5 && sentenceWordCount <= 20) {
      const excerpt =
        firstSentence.length > 60 ? firstSentence.slice(0, 60) + "…" : firstSentence;
      samples.push(`"${heading}" → "${excerpt}"`);
    }
  }

  return { count: samples.length, samples: samples.slice(0, 2) };
}

// ── Phrase-matching helpers ───────────────────────────────────────────────────

function buildPhraseRe(phrases: string[]): RegExp {
  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?:${escaped.join("|")})`, "gi");
}

function countPhraseHits(
  text: string,
  phrases: string[]
): { count: number; samples: string[] } {
  const matches = [...text.matchAll(buildPhraseRe(phrases))].map((m) => m[0]);
  return { count: matches.length, samples: matches.slice(0, 2) };
}

function checkAiTellDensity(
  text: string,
  wordCount: number,
  response?: GenerateArticleResponse
): GeoCheck {
  const c1 = countPhraseHits(text, SIGNIFICANCE_INFLATION);

  const c2Raw = [...text.matchAll(new RegExp(DANGLING_PARTICIPIAL_RE.source, "gi"))];
  const c2 = { count: c2Raw.length, samples: c2Raw.map((m) => m[0].trim()).slice(0, 2) };

  const c3 = countPhraseHits(text, VAGUE_ATTRIBUTION);
  const c4 = countPhraseHits(text, SIGNPOSTING);
  const c5 = response
    ? detectFragmentedHeaders(response)
    : countPhraseHits(text, RESTATEMENT_OPENERS);

  const total = c1.count + c2.count + c3.count + c4.count + c5.count;
  const density = wordCount > 0 ? total / (wordCount / 1000) : 0;
  const pass = density <= 2.0;

  const samples = [
    ...c1.samples, ...c2.samples, ...c3.samples, ...c4.samples, ...c5.samples,
  ].slice(0, 3);

  return {
    label: "AI-tell density",
    pass,
    evidence:
      total === 0
        ? "No AI-tell phrases detected"
        : `${total} tell(s) at ${density.toFixed(1)}/1000 words ${
            pass ? "— within threshold (≤2.0)" : "— exceeds threshold (>2.0)"
          }${samples.length ? ": " + samples.join("; ") : ""}`,
  };
}

// ── Sync export ───────────────────────────────────────────────────────────────

export function detectGeoScoreSignals(text: string): GeoCheck[] {
  const plain = stripHtml(text);
  const wordCount = plain.split(/\s+/).filter(Boolean).length;
  return [
    checkNamedSources(plain),
    checkStatisticsWithSources(plain),
    checkQuotations(plain),
    checkAiTellDensity(plain, wordCount),
  ];
}

// ── 5. Fan-out coverage (heuristic, no LLM) ──────────────────────────────────
// Passes when the article contains ≥ 2 question-style headings (What/How/Why/…)
// OR an explicit FAQ section with ≥ 2 interrogative sentences.
// These headings are themselves the follow-up questions a reader would ask, and
// the section content directly answers them — no LLM needed to verify coverage.

const QUESTION_OPENER_RE = /^(?:what|how|why|when|is|are|can|does|should|which|who|where)\b/i;
const FAQ_MARKER_RE = /\b(?:faq|frequently asked|common questions?)\b/i;
const QUESTION_SENTENCE_RE = /^(?:what|how|why|when|is|are|can|does|should|which|who|where)\b[^?]*\?/gim;

export function checkFanOutCoverage(
  text: string,
  response?: GenerateArticleResponse
): GeoCheck {
  // Structural path: prefer question-style headings when ≥ 2 exist
  if (response?.sections?.length) {
    const questionHeadings = response.sections
      .map((s) => stripHtml(s.heading).trim())
      .filter((h) => QUESTION_OPENER_RE.test(h));

    if (questionHeadings.length >= 2) {
      return {
        label: "FAQ fan-out coverage",
        pass: true,
        evidence: `${questionHeadings.length} question-style headings: ${questionHeadings.slice(0, 2).join("; ")}`,
      };
    }

    // Not enough question headings — fall through to text-based checks.
    // Articles with prose headings + an explicit FAQ section (or ≥2 Q&A sentences)
    // still satisfy fan-out coverage.
  }

  // Text-based: FAQ section heading or ≥ 2 interrogative sentences
  const hasFaqSection = FAQ_MARKER_RE.test(text);
  const questionSentences = [...text.matchAll(QUESTION_SENTENCE_RE)].map((m) => m[0].trim());
  const pass = hasFaqSection || questionSentences.length >= 2;

  return {
    label: "FAQ fan-out coverage",
    pass,
    evidence: pass
      ? hasFaqSection
        ? `FAQ section detected${questionSentences.length > 0 ? ` (${questionSentences.length} Q&A items)` : ""}`
        : `${questionSentences.length} question-style sentences: ${questionSentences.slice(0, 2).join("; ")}`
      : `${questionSentences.length} question-style sentence(s) found (need FAQ section or ≥ 2)`,
  };
}

// ── Top-level score ───────────────────────────────────────────────────────────

export function computeGeoScore(
  text: string,
  _topic: string,
  response?: GenerateArticleResponse
): GeoScore {
  const plain = stripHtml(text);
  const wordCount = plain.split(/\s+/).filter(Boolean).length;

  const checks: GeoCheck[] = [
    checkNamedSources(plain),
    checkStatisticsWithSources(plain),
    checkQuotations(plain),
    checkAiTellDensity(plain, wordCount, response),
    checkFanOutCoverage(plain, response),
  ];

  const score = checks.filter((c) => c.pass).length * 20;
  return { score, checks, wordCount };
}

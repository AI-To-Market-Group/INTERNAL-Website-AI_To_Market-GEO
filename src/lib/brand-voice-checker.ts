/**
 * Brand Voice Checker
 *
 * Detects and corrects three categories of violation in article draft text:
 *   1. Hyphens       — banned everywhere, zero exceptions (no "compound word" carve-out)
 *   2. Contractions  — must be expanded; lookup table handles both straight (‘) and
 *                      curly (‘/’) apostrophes so GPT curly-quote output
 *                      is never missed. Ambiguous contractions (it’s, that’s, he’s…)
 *                      are resolved contextually: if the next word is a past participle
 *                      → "has", otherwise → "is".
 *   3. Forbidden phrases — from BRAND_VOICE.forbidden_phrases
 *   4. Em-dashes / en-dashes — U+2014 (—) and U+2013 (–) matched directly; replace
 *                      with comma, period, or semicolon as context requires.
 *
 * Correction uses a batched GPT-4o call with <<<AITOM_SEP>>> markers. If the response
 * does not return exactly the right number of segments, it falls back to one call per
 * paragraph. The original text is NEVER silently kept when violations were found.
 */

import { BRAND_VOICE } from "@/lib/brand-voice";
import { chatJson } from "@/lib/openai-article";

// ── Constants ─────────────────────────────────────────────────────────────────

const SEP = "<<<AITOM_SEP>>>";
const CORRECTION_MODEL = "gpt-4o";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ViolationType = "hyphen" | "forbidden_phrase" | "contraction" | "dash";

export interface BrandVoiceViolation {
  type: ViolationType;
  match: string;       // exact text that triggered the violation
  suggestion?: string; // expanded form for contractions, dehyphenated form for hyphens
}

export interface CheckResult {
  paragraphIndex: number;
  original: string;    // original HTML paragraph
  violations: BrandVoiceViolation[];
}

export interface CorrectionResult {
  paragraphIndex: number;
  original: string;
  corrected: string;
  changed: boolean;
  // Present and non-empty only when both correction attempts left violations in this paragraph.
  residualViolations?: BrandVoiceViolation[];
}

// ── Past-participle set for ambiguous contraction resolution ──────────────────
// Used to distinguish "it is X" from "it has X" by peeking at the next word.

const PAST_PARTICIPLES = new Set([
  "been", "had", "done", "gone", "said", "taken", "made", "come", "seen",
  "got", "gotten", "become", "found", "given", "known", "left", "meant",
  "paid", "put", "set", "told", "thought", "brought", "felt", "kept",
  "led", "lost", "met", "sent", "spent", "stood", "won", "written",
  "shown", "grown", "drawn", "begun", "broken", "chosen", "fallen",
  "forgotten", "frozen", "hidden", "ridden", "risen", "spoken", "stolen",
  "thrown", "worn", "woken", "proved", "proven", "caused", "worked",
]);

// ── Contraction lookup ────────────────────────────────────────────────────────
// Keys are lowercase with straight apostrophe. normalizeApostrophe() is applied
// before lookup so curly-quote variants ("don’t") hit the same entry.

const UNAMBIGUOUS_CONTRACTIONS: Record<string, string> = {
  "don't":    "do not",
  "won't":    "will not",
  "can't":    "cannot",
  "couldn't": "could not",
  "shouldn't":"should not",
  "wouldn't": "would not",
  "isn't":    "is not",
  "aren't":   "are not",
  "wasn't":   "was not",
  "weren't":  "were not",
  "hasn't":   "has not",
  "haven't":  "have not",
  "hadn't":   "had not",
  "didn't":   "did not",
  "doesn't":  "does not",
  "mustn't":  "must not",
  "needn't":  "need not",
  "mightn't": "might not",
  "shan't":   "shall not",
  "i'm":      "I am",
  "i've":     "I have",
  "i'd":      "I would",
  "i'll":     "I will",
  "you're":   "you are",
  "you've":   "you have",
  "you'd":    "you would",
  "you'll":   "you will",
  "we're":    "we are",
  "we've":    "we have",
  "we'd":     "we would",
  "we'll":    "we will",
  "they're":  "they are",
  "they've":  "they have",
  "they'd":   "they would",
  "they'll":  "they will",
  "here's":   "here is",
  "let's":    "let us",
};

// Ambiguous: can be "[subject] is" or "[subject] has" depending on next word.
const AMBIGUOUS_SUBJECTS: Record<string, string> = {
  "it's":    "it",
  "that's":  "that",
  "he's":    "he",
  "she's":   "she",
  "who's":   "who",
  "what's":  "what",
  "there's": "there",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeApostrophe(s: string): string {
  return s.replace(/[‘’]/g, "'");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function resolveAmbiguousContraction(base: string, nextWord: string | undefined): string {
  const subject = AMBIGUOUS_SUBJECTS[base] ?? base.replace(/'s$/, "");
  const hasPastParticiple = nextWord ? PAST_PARTICIPLES.has(nextWord.toLowerCase()) : false;
  return hasPastParticiple ? `${subject} has` : `${subject} is`;
}

// ── Detection (pure, no LLM) ──────────────────────────────────────────────────

export function detectViolations(paragraphs: string[]): CheckResult[] {
  return paragraphs.map((html, index) => {
    const plain = stripHtml(html);
    const violations: BrandVoiceViolation[] = [];

    // 1. Hyphens — banned everywhere with no compound-word exception.
    //    The regex matches any sequence of word-chars separated by hyphens.
    //    "in-house", "full-funnel", "AI-powered", "practitioner-led" all match.
    const hyphenRe = /\b\w+(?:-\w+)+\b/g;
    let m: RegExpExecArray | null;
    while ((m = hyphenRe.exec(plain)) !== null) {
      violations.push({
        type: "hyphen",
        match: m[0],
        suggestion: m[0].replace(/-/g, " "),
      });
    }

    // 2. Forbidden phrases (case-insensitive exact match)
    for (const phrase of BRAND_VOICE.forbidden_phrases) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "gi");
      while ((m = re.exec(plain)) !== null) {
        violations.push({ type: "forbidden_phrase", match: m[0] });
      }
    }

    // 3. Contractions — handles straight (‘) and curly (‘’) apostrophes
    const contractionRe = /\b([\w]+)[‘’’]([\w]+)\b/g;
    while ((m = contractionRe.exec(plain)) !== null) {
      const raw = m[0];
      const normalized = normalizeApostrophe(raw).toLowerCase();

      if (UNAMBIGUOUS_CONTRACTIONS[normalized]) {
        violations.push({
          type: "contraction",
          match: raw,
          suggestion: UNAMBIGUOUS_CONTRACTIONS[normalized],
        });
        continue;
      }

      if (AMBIGUOUS_SUBJECTS[normalized]) {
        const afterMatch = plain.slice(m.index + raw.length).trimStart();
        const nextWord = afterMatch.match(/^(\w+)/)?.[1];
        violations.push({
          type: "contraction",
          match: raw,
          suggestion: resolveAmbiguousContraction(normalized, nextWord),
        });
      }
    }

    // 4. Em-dashes (U+2014) and en-dashes (U+2013) — matched directly as Unicode
    //    characters; \b\w+ cannot catch non-word characters, so no word boundary needed.
    //    Flags both standalone clause separators ("word — word") and inline ranges.
    //    No deterministic suggestion: the LLM chooses comma, period, or semicolon by context.
    //
    //    Exception: citation attribution dashes (em or en) are exempt.
    //    Pattern: dash followed by optional whitespace + capitalised source name
    //    Year is optional — "— Bain" and "— Bain, 2024" are both citations.
    //    e.g. "— Bain, 2024" / "— Pew Research Center, 2024" / "— McKinsey"
    const CITATION_DASH_RE = /[—–]\s*[A-Z][A-Za-z][\w\s&.,]*/;
    const dashRe = /[—–]/g;
    while ((m = dashRe.exec(plain)) !== null) {
      const tail = plain.slice(m.index);
      // Skip any dash that is the start of a citation attribution
      if (CITATION_DASH_RE.test(tail)) continue;
      violations.push({ type: "dash", match: m[0] });
    }

    return { paragraphIndex: index, original: html, violations };
  });
}

// ── Correction (LLM) ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a precise editorial corrector for AI To Market, a B2B AI consultancy.
Your only job is to fix brand voice violations in the provided paragraphs. Make the minimum changes required.

RULE 1 — HYPHENS (banned everywhere, no exceptions)
Replace every hyphenated word with a space-separated version or rephrase naturally.
Examples: "in-house" → "in house", "full-funnel" → "full funnel",
"AI-powered" → "AI powered", "practitioner-led" → "practitioner led",
"go-to-market" → "go to market", "real-time" → "real time"

RULE 2 — CONTRACTIONS (expand every one)
"don't" → "do not", "can't" → "cannot", "it's" → "it is" or "it has" (context-dependent),
"that's" → "that is" or "that has", "we're" → "we are", "they've" → "they have", etc.

RULE 3 — FORBIDDEN PHRASES (rephrase or remove)
${BRAND_VOICE.forbidden_phrases.map((p) => `"${p}"`).join(", ")}

RULE 4 — EM-DASHES AND EN-DASHES (replace with standard punctuation)
Replace every em-dash (—) and en-dash (–) with the punctuation that fits the context:
- Clause separator ("The model failed — here is why") → period or comma: "The model failed. Here is why." or "The model failed, and here is why."
- Parenthetical aside ("the result — often invisible — was…") → commas: "the result, often invisible, was…"
- Numeric range ("$2M–$5M", "30–45 days") → "to": "$2M to $5M", "30 to 45 days"
EXCEPTION: Do NOT alter citation attribution dashes (em-dash or en-dash). Any dash immediately followed by a capitalised source name is a citation marker — leave it exactly as written, with or without a year.
Examples of exempt citations: "— Bain, 2024" / "— Pew Research Center, 2024" / "— McKinsey" / "– Gartner 2024"
ALSO: Do NOT remove or alter quotation marks that wrap cited text. The pattern "quoted text" — Source is a GEO citation block. Keep the opening and closing quote marks exactly as they are.
Never leave a bare — or – that is NOT a citation attribution (clause separators and ranges must still be replaced).

IMPORTANT CONSTRAINTS
- Preserve all HTML tags exactly — do not alter any <tag> or </tag>
- Do not paraphrase, add, or remove content beyond fixing the violations above
- Preserve surrounding punctuation and capitalisation conventions
- Return valid JSON in the shape: { "corrected": "<your corrected text here>" }`;
}

async function correctOne(text: string): Promise<string> {
  const result = await chatJson<{ corrected: string }>(
    buildSystemPrompt(),
    `Correct the following paragraph:\n\n${text}`,
    CORRECTION_MODEL
  );
  return result?.corrected?.trim() ?? text;
}

async function correctBatch(texts: string[]): Promise<string[] | null> {
  const joined = texts.join(`\n${SEP}\n`);
  const result = await chatJson<{ corrected: string }>(
    buildSystemPrompt(),
    `Correct the following paragraphs. Each paragraph is separated by ${SEP}. ` +
    `Preserve every separator exactly in your output.\n\n${joined}`,
    CORRECTION_MODEL
  );

  if (!result?.corrected) return null;

  const parts = result.corrected.split(SEP).map((p) => p.trim());

  // Separator count mismatch — cannot safely map corrections back to paragraphs
  if (parts.length !== texts.length) {
    console.warn(
      `[brand-voice-checker] batch separator mismatch: expected ${texts.length} segments, got ${parts.length}. Falling back to per-paragraph.`
    );
    return null;
  }

  return parts;
}

async function correctPerParagraph(texts: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const text of texts) {
    results.push(await correctOne(text));
  }
  return results;
}

/**
 * Corrects all paragraphs that have violations, with a verify-and-retry loop.
 *
 * Attempt 1: batch all dirty paragraphs in one GPT-4o call (SEP-separated).
 *            Falls back to per-paragraph if the separator count mismatches.
 * Redetect:  runs detectViolations on attempt 1's output. Paragraphs that still
 *            have violations go into attempt 2.
 * Attempt 2: same batch-then-per-paragraph strategy, scoped to the still-dirty set.
 * Redetect:  runs detectViolations on attempt 2's output. Paragraphs that still
 *            have violations after both attempts are returned with residualViolations
 *            populated — the caller must not silently accept those results.
 */
export async function correctViolations(
  paragraphs: string[],
  checks: CheckResult[]
): Promise<CorrectionResult[]> {
  const dirtyIndices = checks
    .filter((c) => c.violations.length > 0)
    .map((c) => c.paragraphIndex);

  if (dirtyIndices.length === 0) {
    return paragraphs.map((p, i) => ({
      paragraphIndex: i,
      original: p,
      corrected: p,
      changed: false,
    }));
  }

  // correctedTexts is parallel to dirtyIndices (local indexing, 0‥N-1).
  const dirtyTexts = dirtyIndices.map((i) => paragraphs[i]);
  const batch1 = await correctBatch(dirtyTexts);
  let correctedTexts: string[] = batch1 ?? (await correctPerParagraph(dirtyTexts));

  // Redetect on attempt 1 output — local indices only.
  const recheck1 = detectViolations(correctedTexts);
  const stillDirtyLocal1: number[] = recheck1
    .map((c, li) => (c.violations.length > 0 ? li : -1))
    .filter((li) => li !== -1);

  // residualMap: local index → violations that survived both attempts.
  const residualMap = new Map<number, BrandVoiceViolation[]>();

  if (stillDirtyLocal1.length > 0) {
    const attempt2Texts = stillDirtyLocal1.map((li) => correctedTexts[li]);
    const batch2 = await correctBatch(attempt2Texts);
    const corrected2: string[] = batch2 ?? (await correctPerParagraph(attempt2Texts));

    // Patch correctedTexts in-place with attempt 2 results.
    stillDirtyLocal1.forEach((li, i) => {
      correctedTexts[li] = corrected2[i];
    });

    // Redetect on attempt 2 output only (scoped to the re-corrected subset).
    const recheck2 = detectViolations(corrected2);
    for (let i = 0; i < recheck2.length; i++) {
      if (recheck2[i].violations.length > 0) {
        const li = stillDirtyLocal1[i];
        residualMap.set(li, recheck2[i].violations);
      }
    }

    if (residualMap.size > 0) {
      const failedOriginalIndices = [...residualMap.keys()].map((li) => dirtyIndices[li]);
      console.warn(
        `[brand-voice-checker] ${residualMap.size} paragraph(s) still have violations after 2 correction attempts. ` +
        `Original paragraph indices: ${failedOriginalIndices.join(", ")}`
      );
    }
  }

  // Map local indices back to original paragraph indices for the return value.
  const correctedMap = new Map<number, string>(
    dirtyIndices.map((origIdx, li) => [origIdx, correctedTexts[li]])
  );
  const residualOrigMap = new Map<number, BrandVoiceViolation[]>(
    [...residualMap.entries()].map(([li, v]) => [dirtyIndices[li], v])
  );

  return paragraphs.map((p, i) => {
    const corrected = correctedMap.get(i) ?? p;
    const residualViolations = residualOrigMap.get(i);
    return {
      paragraphIndex: i,
      original: p,
      corrected,
      changed: correctedMap.has(i) && corrected !== p,
      ...(residualViolations !== undefined ? { residualViolations } : {}),
    };
  });
}

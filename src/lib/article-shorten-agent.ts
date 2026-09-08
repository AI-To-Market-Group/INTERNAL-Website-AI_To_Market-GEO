/**
 * Article Shorten Agent
 *
 * A post-generation LLM agent that:
 * 1. Measures word count per section after generation/refinement
 * 2. Identifies which sections are over their budget
 * 3. Calls GPT with targeted "shorten this section" instructions
 * 4. Loops up to MAX_ITERATIONS until the article is within budget
 *
 * Unlike prompt-injection (which just hopes GPT counts words),
 * this agent measures, decides, and corrects — it's a critique loop.
 */

import { chatJson } from "@/lib/openai-article";
import { computeBudget } from "@/lib/article-length-controller";
import { getBrandVoiceCompact } from "@/lib/brand-voice";
import type { GenerateArticleResponse, GenerateArticleSectionOutput } from "@/types";

const MAX_ITERATIONS = 2;
const SHORTEN_MODEL = "gpt-5.4-nano";
const OVERAGE_THRESHOLD = 1.25; // section must be 25% over budget before we shorten it

// ── Helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

function countSectionWords(sec: GenerateArticleSectionOutput): number {
  return sec.content.paragraphs.reduce((sum, p) => sum + countWords(p.text), 0);
}

export function countArticleWords(article: GenerateArticleResponse): number {
  return article.sections.reduce((sum, sec) => sum + countSectionWords(sec), 0);
}

// ── Shorten one pass ──────────────────────────────────────────────────────────

interface OverBudgetSection {
  order: number;
  heading: string;
  targetWords: number;
  currentWords: number;
  paragraphs: string[];
}

interface ShortenedSection {
  order: number;
  paragraphs: string[];
}

async function shortenPass(
  article: GenerateArticleResponse,
  totalBudget: number
): Promise<GenerateArticleResponse> {
  const { perSection } = computeBudget(article.sections.length, totalBudget);

  const overBudget: OverBudgetSection[] = article.sections
    .filter((sec) => countSectionWords(sec) > perSection * OVERAGE_THRESHOLD)
    .map((sec) => ({
      order: sec.order,
      heading: sec.heading,
      targetWords: perSection,
      currentWords: countSectionWords(sec),
      paragraphs: sec.content.paragraphs.map((p) => p.text),
    }));

  if (overBudget.length === 0) return article;

  const system = `You are a concise editorial editor. Shorten the provided sections to meet their word budgets.

${await getBrandVoiceCompact()}

Rules:
- Shorten by removing redundancy, trimming wordy phrases, and tightening sentences
- Keep ALL key facts, statistics, and brand/product mentions
- Do NOT remove paragraphs — shorten each one proportionally
- Do NOT change meaning or omit important points
- Do NOT add filler or replacement padding — leave it shorter
- FAQ paragraphs starting with "Q:" must keep their exact "Q:\\nA:" format — only shorten the answer
- Return valid JSON only:
{
  "sections": [
    { "order": 1, "paragraphs": ["shortened paragraph 1", "shortened paragraph 2"] }
  ]
}`;

  const userPrompt = `Shorten these sections. For each, the target word count is given.

${overBudget
    .map(
      (s) =>
        `Section ${s.order} — "${s.heading}"
Target: ${s.targetWords} words (currently ${s.currentWords} words, reduce by ~${s.currentWords - s.targetWords} words)
Paragraphs:
${s.paragraphs.map((p, i) => `[${i + 1}] ${p}`).join("\n\n")}`
    )
    .join("\n\n---\n\n")}`;

  const result = await chatJson<{ sections: ShortenedSection[] }>(
    system,
    userPrompt,
    SHORTEN_MODEL
  );

  if (!result?.sections?.length) return article;

  // Merge shortened sections back into the article
  const patchMap = new Map(result.sections.map((s) => [s.order, s.paragraphs]));

  return {
    ...article,
    sections: article.sections.map((sec) => {
      const shortened = patchMap.get(sec.order);
      if (!shortened) return sec;
      return {
        ...sec,
        content: {
          ...sec.content,
          paragraphs: sec.content.paragraphs.map((p, i) => ({
            ...p,
            text: shortened[i] ?? p.text,
          })),
        },
      };
    }),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run the shorten agent loop.
 * Calls GPT up to MAX_ITERATIONS times, each time only targeting sections
 * that are still over budget. Stops early if already within budget.
 */
export async function shortenArticleToTarget(
  article: GenerateArticleResponse,
  totalBudget: number
): Promise<GenerateArticleResponse> {
  let current = article;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const words = countArticleWords(current);
    if (words <= totalBudget) break;
    console.log(`[shorten-agent] pass ${i + 1}: ${words} words → targeting ${totalBudget}`);
    current = await shortenPass(current, totalBudget);
  }

  return current;
}

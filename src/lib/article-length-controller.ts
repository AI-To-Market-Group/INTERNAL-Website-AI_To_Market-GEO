/**
 * Article Length Controller
 *
 * Single source of truth for word-count budgets injected into generation
 * and refinement prompts. All routes import from here — no hardcoded
 * numbers scattered across individual prompt strings.
 */

const DEFAULT_TOTAL_BUDGET = 900; // words — sweet spot for GEO citation density
const AVG_PARAGRAPHS_PER_SECTION = 2.5;

export interface LengthBudget {
  total: number;
  perSection: number;
  perParagraph: number;
}

export function computeBudget(
  sectionCount: number,
  totalBudget = DEFAULT_TOTAL_BUDGET
): LengthBudget {
  const perSection = Math.round(totalBudget / sectionCount);
  const perParagraph = Math.round(perSection / AVG_PARAGRAPHS_PER_SECTION);
  return { total: totalBudget, perSection, perParagraph };
}

/**
 * Returns the length-control block to inject into a GENERATION prompt.
 * Call this in validate-plan with outline.length as sectionCount.
 */
export function getGenerationLengthPrompt(sectionCount: number): string {
  const { total, perSection, perParagraph } = computeBudget(sectionCount);
  return `WORD COUNT CONTROLLER (mandatory):
- Total article: ${total} words maximum across all sections
- Per section: ~${perSection} words
- Per paragraph: ~${perParagraph} words — write 2–3 paragraphs per section, no more
- Count words as you write each section. Stop adding content the moment you reach the section budget.
- Shorter, denser paragraphs are better than longer, padded ones.`;
}

/**
 * Returns the length-control block to inject into a REFINEMENT prompt.
 * Call this in refine-draft with the current article's actual word count
 * so GPT is told to stay within what already exists.
 */
export function getRefinementLengthPrompt(currentWordCount: number): string {
  const ceiling = Math.round(currentWordCount * 1.05); // allow max +5%
  return `WORD COUNT CONTROLLER (mandatory):
- The input article is ~${currentWordCount} words.
- The refined output MUST NOT exceed ${ceiling} words.
- Improve quality by replacing weak words, not by adding new ones.
- If you remove filler, do NOT backfill with new content. Leave the gap shorter.`;
}

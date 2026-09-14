import type { GenerateArticleResponse, GenerateArticleSectionOutput, QualityFlag } from "@/types";
import { DEFAULT_WORD_COUNT_TARGETS } from "@/lib/brand-voice";

const GENERIC_ATTRIBUTION_PHRASES = [
  /according to research/gi,
  /studies show/gi,
  /industry data indicates/gi,
];

function sectionWordCount(section: GenerateArticleSectionOutput): number {
  const paragraphText = section.content.paragraphs.map((p) => p.text).join(" ");
  const bulletsText = (section.content.bullets ?? []).join(" ");
  return (paragraphText + " " + bulletsText).trim().split(/\s+/).filter(Boolean).length;
}

function fullArticleText(article: GenerateArticleResponse): string {
  return article.sections
    .flatMap((s) => [
      ...s.content.paragraphs.map((p) => p.text),
      ...(s.content.bullets ?? []),
    ])
    .join(" ");
}

export function reviewArticleQuality(
  article: GenerateArticleResponse,
  targetKeywords: string[] = [],
  wordCountTargets: Record<string, number> = DEFAULT_WORD_COUNT_TARGETS,
): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const fullText = fullArticleText(article);

  // Thin section check
  for (const section of article.sections) {
    const minWords = wordCountTargets[section.type] ?? DEFAULT_WORD_COUNT_TARGETS[section.type] ?? 150;
    const count = sectionWordCount(section);
    if (count < minWords) {
      flags.push({
        section: section.heading,
        type: "thin_section",
        message: `"${section.heading}" is too short (${count} words, minimum ${minWords} for ${section.type}).`,
      });
    }
  }

  // Attribution overuse check
  let genericCount = 0;
  for (const pattern of GENERIC_ATTRIBUTION_PHRASES) {
    genericCount += (fullText.match(pattern) ?? []).length;
  }
  if (genericCount > 2) {
    flags.push({
      type: "attribution_overuse",
      message: `Generic attribution phrases used ${genericCount} times (max 2). Replace with named sources.`,
    });
  }

  // Missing keyword check
  const lowerText = fullText.toLowerCase();
  for (const kw of targetKeywords) {
    if (kw && !lowerText.includes(kw.toLowerCase())) {
      flags.push({
        type: "missing_keyword",
        message: `Target keyword "${kw}" does not appear in the article.`,
      });
    }
  }

  // Malformed-content check: catches fields that got stringified from the
  // wrong shape (e.g. a model returning bullet objects instead of plain
  // strings) before they ever reach the reader as literal "[object Object]".
  const MALFORMED_RE = /\[object Object\]|\bundefined\b|\bNaN\b/;
  for (const section of article.sections) {
    const bulletsText = (section.content.bullets ?? []).join(" ");
    if (MALFORMED_RE.test(bulletsText)) {
      flags.push({
        section: section.heading,
        type: "malformed_content",
        message: `"${section.heading}" has malformed bullet content (a bullet rendered as a raw object instead of text).`,
      });
    }
    for (const p of section.content.paragraphs) {
      if (MALFORMED_RE.test(p.text)) {
        flags.push({
          section: section.heading,
          type: "malformed_content",
          message: `"${section.heading}" has a malformed paragraph (renders as a raw object/undefined instead of text).`,
        });
      }
    }
  }

  return flags;
}

import type {
  OutlineSection,
  ArticleDraft,
  ArticleDraftBlock,
  GenerateArticleSectionsResponse,
  GenerateArticleRequest,
  GenerateArticleResponse,
  GenerateArticleSection,
  ReviseArticleSectionRequest,
  ReviseArticleSectionResponse,
} from "@/types";

const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const WP_CATEGORIES = [
  "AI in Marketing",
  "AI in Sales",
  "AI in Supply Chain",
  "AI Strategy",
  "News",
];

const formatOutlineContent = (lines: string[] = []) =>
  lines
    .map((line) => `• ${line.replace(/^[•\-*]\s*/, "").trim()}`)
    .join("\n");

/** Parse outline section content (• line1\n• line2) into description array. */
function contentToDescription(content: string | undefined): string[] {
  if (!content?.trim()) return [];
  return content
    .split(/\n/)
    .map((line) => line.replace(/^\s*•\s*/, "").trim())
    .filter(Boolean);
}

export function outlineSectionToGenerateArticleSection(
  section: OutlineSection,
  order: number
): GenerateArticleSection {
  return {
    order,
    type: section.type ?? section.title,
    title: section.title,
    description: contentToDescription(section.content),
    keywords: section.seo?.keywords ?? [],
  };
}

/** Build revise-section request body from outline section. */
export function outlineSectionToReviseSectionRequest(
  section: OutlineSection,
  order: number
): ReviseArticleSectionRequest {
  return {
    order,
    title: section.title,
    description: contentToDescription(section.content),
    language: "en",
  };
}

/** Build POST /generate-article request from current outline and article title. */
export function outlineToGenerateArticleRequest(
  outline: OutlineSection[],
  articleTitle: string
): GenerateArticleRequest {
  const sections: GenerateArticleSection[] = outline.map((sec, index) =>
    outlineSectionToGenerateArticleSection(sec, index + 1)
  );
  return { sections, article_title: articleTitle };
}

/** Map API revised section response back into outline section. */
export function mapRevisedSectionToOutline(
  section: OutlineSection,
  revised: ReviseArticleSectionResponse
): OutlineSection {
  return {
    ...section,
    type: revised.type,
    title: revised.title,
    content: formatOutlineContent(revised.description),
    bullets: [],
    seo: { ...section.seo, keywords: revised.keywords },
  };
}

/** Map POST /generate-article response to ArticleDraft for DraftEditor. */
export function mapGenerateArticleResponseToDraft(
  response: GenerateArticleResponse
): ArticleDraft {
  const blocks: ArticleDraftBlock[] = [];
  for (const sec of response.sections.sort((a, b) => a.order - b.order)) {
    blocks.push({
      id: uid(),
      type: "heading",
      content: sec.heading,
      meta: { sectionOrder: sec.order, sectionType: sec.type },
    });
    for (const p of sec.content.paragraphs) {
      blocks.push({
        id: uid(),
        type: "paragraph",
        content: p.text,
        meta: { sectionOrder: sec.order, sectionType: sec.type, paragraphId: p.id },
      });
    }
  }
  return {
    id: uid(),
    title: response.title,
    blocks,
    updatedAt: new Date().toISOString(),
  };
}

export function mapGeneratedSectionsToOutline(
  response: GenerateArticleSectionsResponse
): OutlineSection[] {
  return [...response.sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      id: uid(),
      headingLevel: "H2",
      type: section.type,
      title: section.title,
      content: formatOutlineContent(section.description),
      bullets: [],
      seo: { keywords: section.keywords ?? [] },
    }));
}

/** Create default WordPress metadata from title (used when API metadata is not yet generated). */
export function defaultWpMetadata(
  opportunityTitle: string,
  draftTitle: string
): import("@/types").WordPressMetadata {
  const slugBase = draftTitle
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return {
    title: draftTitle,
    slug: slugBase || "article-ai-to-market",
    excerpt: `Discover everything you need to know about ${draftTitle}. Practical guide and tips by AI To Market.`,
    category: WP_CATEGORIES[0],
    tags: ["AI", "strategy", "guide", draftTitle.split(" ")[0] || "insights"],
    focus_keyword: "",
    seo_title: "",
    seo_description: "",
  };
}

/** Convert ArticleDraft blocks to markdown for Content Forge. */
export function draftToMarkdown(draft: ArticleDraft): string {
  const lines: string[] = [];
  for (const block of draft.blocks ?? []) {
    const text = (block.content ?? "").replace(/<[^>]+>/g, "").trim();
    if (!text) continue;
    if (block.type === "heading") {
      lines.push(`## ${text}`, "");
    } else {
      lines.push(text, "");
    }
  }
  return lines.join("\n").trimEnd() || "Content to be written...\n";
}

/** Duplicate a section with "(copie)" suffix and new ids. */
export function duplicateOutlineSection(section: OutlineSection): OutlineSection {
  return {
    ...section,
    id: uid(),
    title: `${section.title} (copie)`,
    content: section.content,
    bullets: section.bullets.map((b) => ({ ...b, id: uid() })),
  };
}

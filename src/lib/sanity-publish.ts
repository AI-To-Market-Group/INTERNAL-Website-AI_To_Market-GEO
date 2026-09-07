import type { ArticleDraftBlock, BuilderSessionInfo, WordPressMetadata } from "@/types";

/** Strip all HTML to plain text — used for headings and read-time estimation. */
function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove only dangerous elements/attributes; keep bold, italic, links, lists, blockquotes, code. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
    .trim();
}

/** Wrap inline HTML in a <p> tag if it isn't already block-level. */
function wrapIfInline(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  return /^<(p|ul|ol|div|blockquote|details|h[1-6])\b/i.test(trimmed) ? trimmed : `<p>${trimmed}</p>`;
}

/** Convert a FAQ block to a native <details> accordion item.
 *  Handles three storage formats from different generators:
 *  1. "Q: question\nA: answer"  (fix-geo output)
 *  2. "Q: question A: answer"   (original article generator, same line)
 *  3. "<p>Q: question A: answer</p>"  (HTML-wrapped version)
 */
function faqBlockToHtml(text: string): string {
  // Strip outer <p> wrapper if present
  const clean = text.replace(/^\s*<p>\s*/i, "").replace(/\s*<\/p>\s*$/i, "").trim();

  // Format 1: newline between Q and A
  const nlMatch = clean.match(/^Q:\s*(.+?)[\r\n]+A:\s*([\s\S]+)$/);
  if (nlMatch) {
    return `<details class="faq-item"><summary><span>${nlMatch[1].trim()}</span></summary><p>${nlMatch[2].trim()}</p></details>`;
  }

  // Format 2: same-line "Q: question A: answer" — split on first " A: "
  if (/^Q:\s/i.test(clean)) {
    const aIdx = clean.search(/\sA:\s/);
    if (aIdx !== -1) {
      const q = clean.slice(clean.indexOf(":") + 1, aIdx).trim();
      const a = clean.slice(aIdx).replace(/^\s*A:\s*/i, "").trim();
      if (q && a) {
        return `<details class="faq-item"><summary><span>${q}</span></summary><p>${a}</p></details>`;
      }
    }
  }

  return `<p>${sanitizeHtml(text)}</p>`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);
}

function blocksToContentNews(blocks: ArticleDraftBlock[]) {
  const introParagraphs: string[] = [];
  const sections: Array<{
    _type: string;
    _key: string;
    heading: string;
    level: "h2" | "h3";
    body: string;
  }> = [];

  let inIntro = true;
  let currentHeading = "";
  let currentBodyParts: string[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      if (!inIntro && currentHeading) {
        sections.push({
          _type: "newsSection",
          _key: `s${sections.length}`,
          heading: currentHeading,
          level: "h2",
          body: currentBodyParts.map((h) => wrapIfInline(sanitizeHtml(h))).filter(Boolean).join("") || " ",
        });
        currentBodyParts = [];
      }
      inIntro = false;
      currentHeading = stripHtmlToPlain(block.content);
    } else if (block.type === "paragraph") {
      const isFaq = block.meta?.sectionType === "faq"
        || /^Q:\s/i.test(block.content.trim())
        || /^<p>\s*Q:\s/i.test(block.content.trim());
      const processed = isFaq ? faqBlockToHtml(block.content) : block.content;
      if (inIntro) {
        introParagraphs.push(processed);
      } else {
        currentBodyParts.push(processed);
      }
    }
  }

  if (!inIntro && currentHeading) {
    sections.push({
      _type: "newsSection",
      _key: `s${sections.length}`,
      heading: currentHeading,
      level: "h2",
      body: currentBodyParts.map((h) => wrapIfInline(sanitizeHtml(h))).filter(Boolean).join("") || " ",
    });
  }

  const lead = wrapIfInline(sanitizeHtml(introParagraphs[0] ?? "")) || " ";
  const secondParagraph =
    introParagraphs.slice(1).map((h) => wrapIfInline(sanitizeHtml(h))).filter(Boolean).join("") || " ";

  if (sections.length === 0) {
    sections.push({ _type: "newsSection", _key: "s0", heading: "Overview", level: "h2", body: lead });
  }

  return { _type: "contentNews", lead, secondParagraph, sections };
}

function estimateReadTime(blocks: ArticleDraftBlock[]): string {
  const text = blocks.map((b) => stripHtmlToPlain(b.content)).join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

// ---------------------------------------------------------------------------

export interface SanityPublishResult {
  documentId: string;
  studioUrl: string;
}

export async function publishLiveToSanity(sessionId: string): Promise<SanityPublishResult> {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET ?? "production";
  const token = process.env.SANITY_API_TOKEN;
  const apiVersion = process.env.SANITY_API_VERSION ?? "2024-01-01";

  if (!projectId || !token) {
    throw new Error("Sanity is not configured. Set SANITY_PROJECT_ID and SANITY_API_TOKEN in .env");
  }

  const draftId = `drafts.geo-${sessionId}`;
  const publishedId = `geo-${sessionId}`;

  // Fetch the draft document
  const fetchRes = await fetch(
    `https://${projectId}.api.sanity.io/v${apiVersion}/data/doc/${dataset}/${encodeURIComponent(draftId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!fetchRes.ok) throw new Error(`Failed to fetch Sanity draft: ${fetchRes.status}`);

  const fetchData = await fetchRes.json();
  const draftDoc = fetchData.documents?.[0];
  if (!draftDoc) throw new Error("Draft not found in Sanity. Use 'Send as draft' first.");

  // Publish: create doc without drafts. prefix, delete the draft
  const res = await fetch(
    `https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        mutations: [
          { createOrReplace: { ...draftDoc, _id: publishedId } },
          { delete: { id: draftId } },
        ],
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sanity publish error ${res.status}: ${body}`);
  }

  const slug = draftDoc.slug?.current ?? publishedId;
  const liveUrl = `https://www.aitomarketgroup.com/news/${encodeURIComponent(slug)}`;
  return { documentId: publishedId, studioUrl: liveUrl };
}

export async function publishToSanity(
  session: BuilderSessionInfo,
  wpMetadata: WordPressMetadata | null | undefined
): Promise<SanityPublishResult> {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET ?? "production";
  const token = process.env.SANITY_API_TOKEN;
  const apiVersion = process.env.SANITY_API_VERSION ?? "2024-01-01";

  if (!projectId || !token) {
    throw new Error("Sanity is not configured. Set SANITY_PROJECT_ID and SANITY_API_TOKEN in .env");
  }

  const draft = session.draft;
  if (!draft) throw new Error("No draft to publish.");

  const title = draft.title ?? session.topicTitle;
  const slug = wpMetadata?.slug ?? slugify(title);
  const excerpt = wpMetadata?.excerpt ?? wpMetadata?.seo_description ?? "";
  const publishedAt = new Date().toISOString();

  const documentId = `drafts.geo-${session.sessionId}`;

  const doc = {
    _type: "blogPost",
    _id: documentId,
    title,
    slug: { _type: "slug", current: slug },
    category: "news",
    excerpt,
    author: "AI To Market",
    publishedAt,
    readTime: estimateReadTime(draft.blocks),
    contentNews: blocksToContentNews(draft.blocks),
  };

  const res = await fetch(
    `https://${projectId}.api.sanity.io/v${apiVersion}/data/mutate/${dataset}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mutations: [{ createOrReplace: doc }] }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sanity API error ${res.status}: ${body}`);
  }

  const studioUrl = `https://${projectId}.sanity.studio/structure/blogPost;${encodeURIComponent(documentId)}`;

  return { documentId, studioUrl };
}

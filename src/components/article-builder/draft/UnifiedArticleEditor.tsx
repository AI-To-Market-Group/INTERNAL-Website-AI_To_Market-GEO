"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ArticleDraft, ArticleDraftBlock } from "@/types";

const BLOCK_ATTR = "data-block-id";
const TYPE_ATTR = "data-block-type";
const SECTION_TYPE_ATTR = "data-section-type";

function isFaqParagraph(block: ArticleDraftBlock): boolean {
  return (
    block.type === "paragraph" &&
    ((block.meta as Record<string, unknown>)?.sectionType === "faq" ||
      block.content.trimStart().startsWith("Q:"))
  );
}

function renderFaqBlock(block: ArticleDraftBlock): string {
  // Normalise HTML line-breaks to plain newlines, then strip all tags.
  const raw = block.content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  // Helper: build the final <details> HTML from split parts.
  const makeFaq = (q: string, a: string) => {
    const cq = /[?!.]$/.test(q.trim()) ? q.trim() : q.trim() + "?";
    return `<div class="faq-item"><details><summary>${cq}</summary><div class="faq-answer">${a.trim()}</div></details></div>`;
  };

  // 1. Canonical  "Q: question\nA: answer"
  const nlAIdx = raw.indexOf("\nA:");
  if (nlAIdx > 2) {
    const q = raw.slice(raw.startsWith("Q:") ? 2 : 0, nlAIdx).trim();
    const a = raw.slice(nlAIdx + 3).trim();
    return makeFaq(q, a);
  }

  // 2. Inline " A:" / "?A:" / ".A:" — refine step sometimes drops the newline
  const inlineA = raw.match(/(?<=[\s?.!])A:\s*/);
  if (inlineA?.index && inlineA.index > 0) {
    const aStart = raw.indexOf("A:", inlineA.index);
    const q = raw.slice(raw.startsWith("Q:") ? 2 : 0, aStart).trim();
    const a = raw.slice(aStart + 2).trim();
    if (q && a) return makeFaq(q, a);
  }

  // 3. "Question?: Answer" — mini model often outputs this instead of Q:/A: labels
  const qColonMatch = raw.match(/\?:\s+/);
  if (qColonMatch?.index !== undefined) {
    const q = raw.slice(0, qColonMatch.index + 1).trim();
    const a = raw.slice(qColonMatch.index + qColonMatch[0].length).trim();
    if (q && a) return makeFaq(q, a);
  }

  // 4. "Question?Answer" — question mark directly followed by a capital letter
  const qUpperMatch = raw.match(/\?([A-Z])/);
  if (qUpperMatch?.index !== undefined) {
    const q = raw.slice(0, qUpperMatch.index + 1).trim();
    const a = raw.slice(qUpperMatch.index + 1).trim();
    if (q && a) return makeFaq(q, a);
  }

  // 5. Fallback — show everything as the summary with no answer
  const summary = raw.replace(/^Q:\s*/, "").trim();
  return `<div class="faq-item"><details><summary>${summary}</summary><div class="faq-answer"></div></details></div>`;
}

interface UnifiedArticleEditorProps {
  draft: ArticleDraft;
  onUpdate: (draft: ArticleDraft) => void;
  className?: string;
  editorRef?: React.RefObject<HTMLDivElement | null>;
  /** blockId → array of plain-text matches to highlight as brand-voice violations */
  violationMatches?: Map<string, string[]>;
}

// Walk text nodes inside el and wrap the first occurrence of each match
// with a <mark data-bv-violation> element (amber highlight, non-destructive).
function applyViolationHighlights(el: HTMLElement, matches: string[]): void {
  if (!matches.length) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n = walker.nextNode();
  while (n) { textNodes.push(n as Text); n = walker.nextNode(); }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    for (const match of matches) {
      const idx = text.indexOf(match);
      if (idx === -1) continue;
      const parent = textNode.parentNode;
      if (!parent) break;
      const mark = document.createElement("mark");
      mark.setAttribute("data-bv-violation", "true");
      mark.style.cssText =
        "background:#fef3c7;color:#92400e;border-radius:2px;padding:0 2px;outline:1px solid #f59e0b;";
      mark.textContent = match;
      parent.insertBefore(document.createTextNode(text.slice(0, idx)), textNode);
      parent.insertBefore(mark, textNode);
      parent.insertBefore(document.createTextNode(text.slice(idx + match.length)), textNode);
      parent.removeChild(textNode);
      break;
    }
  }
}

/**
 * Single contenteditable for the whole article. Allows selection across blocks.
 * Keeps block structure for WordPress export.
 */
export function UnifiedArticleEditor({
  draft,
  onUpdate,
  className,
  editorRef: externalRef,
  violationMatches,
}: UnifiedArticleEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ref = externalRef ?? containerRef;
  const isInternalChange = useRef(false);

  const blocks = draft.blocks ?? [];

  const syncFromDom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const blockEls = container.querySelectorAll(`[${BLOCK_ATTR}]`);
    const newBlocks: ArticleDraftBlock[] = [];
    blockEls.forEach((el, i) => {
      const id = el.getAttribute(BLOCK_ATTR);
      const type = (el.getAttribute(TYPE_ATTR) || "paragraph") as ArticleDraftBlock["type"];
      // Strip violation highlight marks before storing — they are display-only
      const raw = (el as HTMLElement).innerHTML;
      const content = raw.replace(/<mark[^>]*data-bv-violation[^>]*>([\s\S]*?)<\/mark>/gi, "$1").trim();
      const existing = blocks.find((b) => b.id === id);
      newBlocks.push({
        id: id || `block-${i}`,
        type,
        content,
        meta: existing?.meta,
      });
    });
    if (newBlocks.length === 0) return;
    const changed =
      newBlocks.length !== blocks.length ||
      newBlocks.some((nb, i) => nb.content !== blocks[i]?.content);
    if (changed) {
      isInternalChange.current = true;
      onUpdate({ ...draft, blocks: newBlocks });
    }
  }, [draft, blocks, onUpdate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    container.innerHTML = "";
    let faqWrapper: HTMLDivElement | null = null;

    blocks.forEach((block) => {
      const isFaq = isFaqParagraph(block);

      if (isFaq) {
        if (!faqWrapper) {
          faqWrapper = document.createElement("div");
          faqWrapper.className = "faq-block-wrapper";
          container.appendChild(faqWrapper);
        }
        const div = document.createElement("div");
        div.setAttribute(BLOCK_ATTR, block.id);
        div.setAttribute(TYPE_ATTR, block.type);
        div.setAttribute(SECTION_TYPE_ATTR, "faq");
        div.innerHTML = renderFaqBlock(block);
        faqWrapper.appendChild(div);
        return;
      }

      faqWrapper = null;
      const div = document.createElement("div");
      div.setAttribute(BLOCK_ATTR, block.id);
      div.setAttribute(TYPE_ATTR, block.type);
      div.className =
        block.type === "heading"
          ? "text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 mt-6 mb-2 first:mt-0"
          : "py-2 text-gray-700";
      div.innerHTML = block.content || (block.type === "heading" ? "" : "<br>");
      container.appendChild(div);

      // Apply brand-voice violation highlights for this block
      const matches = violationMatches?.get(block.id);
      if (matches?.length) applyViolationHighlights(div, matches);
    });
  }, [blocks, violationMatches]);

  const handleInput = () => {
    requestAnimationFrame(syncFromDom);
  };

  const handleBlur = () => {
    syncFromDom();
  };

  return (
    <div
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (externalRef) externalRef.current = el;
      }}
      contentEditable
      suppressContentEditableWarning
      className={cn(
        "w-full text-base text-gray-700 border-none outline-none bg-transparent leading-relaxed",
        "min-h-[20rem] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600",
        className
      )}
      style={{
        lineHeight: 1.8,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
      onInput={handleInput}
      onBlur={handleBlur}
    />
  );
}

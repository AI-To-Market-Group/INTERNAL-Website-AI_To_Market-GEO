"use client";

import { useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UnifiedArticleEditor } from "./UnifiedArticleEditor";
import { FloatingSelectionToolbar } from "./FloatingSelectionToolbar";
import { postReviseSelection, reviseSelection } from "@/lib/api";
import type { ArticleDraft, BrandVoiceResidual } from "@/types";

interface DraftEditorProps {
  draft: ArticleDraft;
  onUpdate: (draft: ArticleDraft) => void;
  outlineEditedAfterDraft: boolean;
  onUpdateDraftFromOutline: () => void;
  onDismissOutlineBanner: () => void;
  /** Phase 5: when set, use POST .../edit-paragraph (LLM + session). */
  opportunityId?: string;
  /** Register a function to apply an AI revision to the current selection (e.g. from chat). */
  registerApplyRevision?: (apply: (instruction: string) => Promise<void>) => void;
  /** Brand voice residuals — violation matches highlighted inline in the editor */
  brandVoiceResiduals?: BrandVoiceResidual[];
}

export function DraftEditor({
  draft,
  onUpdate,
  outlineEditedAfterDraft,
  onUpdateDraftFromOutline,
  onDismissOutlineBanner,
  opportunityId,
  registerApplyRevision,
  brandVoiceResiduals,
}: DraftEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSelectionRef = useRef<{ range: Range; text: string } | null>(null);

  const handleAiModify = useCallback(
    async (
      selectedText: string,
      instruction?: string
    ): Promise<string | null> => {
      const articleContext = (draft.blocks ?? [])
        .map((b) => b.content)
        .filter(Boolean)
        .join("\n\n");
      try {
        const body = {
          selected_text: selectedText,
          change_request: instruction || undefined,
          language: "en",
          article_context: articleContext || undefined,
        };
        const res = opportunityId
          ? await postReviseSelection(opportunityId, body)
          : await reviseSelection(body);
        return res.text ?? null;
      } catch {
        toast.error("Failed to revise selection");
        return null;
      }
    },
    [opportunityId, draft.blocks]
  );

  const applyRevisionToSelection = useCallback(
    async (instruction: string) => {
      const sel = lastSelectionRef.current;
      if (!sel?.text?.trim()) {
        toast.error("Select text in the article first, then try again.");
        return;
      }
      const revised = await handleAiModify(sel.text, instruction);
      if (revised) {
        const selection = window.getSelection();
        if (selection && sel.range) {
          selection.removeAllRanges();
          selection.addRange(sel.range);
          document.execCommand("insertHTML", false, revised);
        }
        editorRef.current?.focus();
        lastSelectionRef.current = null;
      }
    },
    [handleAiModify]
  );

  useEffect(() => {
    if (!registerApplyRevision) return;
    registerApplyRevision(applyRevisionToSelection);
  }, [registerApplyRevision, applyRevisionToSelection]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) {
        return;
      }
      const text = selection.toString().trim();
      if (text) {
        try {
          lastSelectionRef.current = { range: selection.getRangeAt(0).cloneRange(), text };
        } catch {
          lastSelectionRef.current = null;
        }
      } else {
        lastSelectionRef.current = null;
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  // Build blockId → violation match strings map from residuals.
  // paragraphIndex maps to draft.blocks[paragraphIndex].
  const violationMatches = useMemo<Map<string, string[]>>(() => {
    const map = new Map<string, string[]>();
    if (!brandVoiceResiduals?.length) return map;
    for (const residual of brandVoiceResiduals) {
      const block = draft.blocks[residual.paragraphIndex];
      if (!block) continue;
      const existing = map.get(block.id) ?? [];
      for (const v of residual.violations) {
        if (!existing.includes(v.match)) existing.push(v.match);
      }
      map.set(block.id, existing);
    }
    return map;
  }, [brandVoiceResiduals, draft.blocks]);

  return (
    <div className="article-editor-scale">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 min-w-0">
        {outlineEditedAfterDraft && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6">
            <p className="text-sm text-amber-900">
              The plan has changed. Would you like to regenerate the article?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onDismissOutlineBanner}>
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={onUpdateDraftFromOutline}
              >
                Regenerate
              </Button>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-visible">
          <div className="px-4 pt-4 sm:px-8 sm:pt-8 lg:px-12 lg:pt-12 pb-16 sm:pb-24 overflow-visible">
            <div className="max-w-4xl mx-auto overflow-visible w-full relative">
              <UnifiedArticleEditor
                draft={draft}
                onUpdate={onUpdate}
                editorRef={editorRef}
                violationMatches={violationMatches.size > 0 ? violationMatches : undefined}
              />
              <FloatingSelectionToolbar
                editorRef={editorRef}
                onAiModify={handleAiModify}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bold, Italic, Type, ChevronDown, Sparkles } from "lucide-react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FloatingSelectionToolbarProps {
  editorRef: React.RefObject<HTMLElement | null>;
  /** Async: returns revised text to replace selection, or null on error. */
  onAiModify?: (selectedText: string, instruction?: string) => Promise<string | null>;
}

const exec = (command: string, value?: string) => {
  document.execCommand(command, false, value ?? undefined);
  const el = document.activeElement as HTMLElement | null;
  if (el?.isContentEditable) el.focus();
};

const TEXT_STYLES: Array<
  | { label: string; command: "formatBlock"; value: string }
  | { label: string; command: "insertUnorderedList" | "insertOrderedList" }
> = [
  { label: "Text", command: "formatBlock", value: "p" },
  { label: "Heading 1", command: "formatBlock", value: "h1" },
  { label: "Heading 2", command: "formatBlock", value: "h2" },
  { label: "Heading 3", command: "formatBlock", value: "h3" },
  { label: "Bullet list", command: "insertUnorderedList" },
  { label: "Numbered list", command: "insertOrderedList" },
  { label: "Quote", command: "formatBlock", value: "blockquote" },
];

export function FloatingSelectionToolbar({
  editorRef,
  onAiModify,
}: FloatingSelectionToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [showTextMenu, setShowTextMenu] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const updateSelection = useCallback(() => {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor || selection.rangeCount === 0) {
      setPosition(null);
      setShowTextMenu(false);
      return;
    }
    if (!editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) {
      setPosition(null);
      setShowTextMenu(false);
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      setPosition(null);
      setShowTextMenu(false);
      return;
    }
    setSelectedText(text);
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const toolbarWidth = 280;
    const toolbarHeight = 44;
    let left = rect.left + rect.width / 2 - toolbarWidth / 2;
    let top = rect.top - toolbarHeight - 8;
    if (left < 8) left = 8;
    if (left + toolbarWidth > window.innerWidth - 8) left = window.innerWidth - toolbarWidth - 8;
    if (top < 8) top = rect.bottom + 8;
    setPosition({ top, left });
  }, [editorRef]);

  const hide = useCallback(() => {
    setPosition(null);
    setShowTextMenu(false);
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    const selection = window.getSelection();
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  const handleFormat = useCallback(
    (command: string, value?: string) => {
      restoreSelection();
      exec(command, value);
      setShowTextMenu(false);
      updateSelection();
    },
    [restoreSelection, updateSelection]
  );

  useEffect(() => {
    const handleSelectionChange = () => {
      requestAnimationFrame(updateSelection);
    };
    const handleMouseUp = () => {
      requestAnimationFrame(updateSelection);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if (editorRef.current?.contains(target)) return;
      setShowTextMenu(false);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [updateSelection, editorRef]);


  const toolbar = position ? (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-orientation="horizontal"
      className="fixed z-50 flex h-9 w-fit min-w-0 shrink items-center overflow-visible rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-[0_4px_12px_0_rgba(0,0,0,0.08),0_0_1px_0_rgba(0,0,0,0.04)]"
      style={{
        top: position.top,
        left: position.left,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {onAiModify && (
        <>
          <button
            type="button"
            className="flex h-full items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            onMouseDown={(e) => {
              e.preventDefault();
              setAiInstruction("");
              setShowAiModal(true);
            }}
          >
            <Sparkles className="h-4 w-4" />
            <span>Ask for modification</span>
          </button>
          <div role="separator" className="mx-1 h-5 w-px bg-slate-200" />
        </>
      )}
      <button
        type="button"
        className="flex h-full items-center rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100"
        aria-label="Bold"
        onClick={() => handleFormat("bold")}
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex h-full items-center rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100"
        aria-label="Italic"
        onClick={() => handleFormat("italic")}
      >
        <Italic className="h-4 w-4" />
      </button>
      <div className="relative">
        <button
          type="button"
          className="flex h-full items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          aria-label="Text styles"
          aria-haspopup="menu"
          aria-expanded={showTextMenu}
          onMouseDown={(e) => {
            e.preventDefault();
            setShowTextMenu((v) => !v);
          }}
        >
          <Type className="h-4 w-4" />
          <span>Text</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showTextMenu ? "rotate-180" : ""}`}
          />
        </button>
        {showTextMenu && (
          <div
            className="absolute left-0 top-full z-10 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            role="menu"
            onMouseDown={(e) => e.preventDefault()}
          >
            {TEXT_STYLES.map((item) => (
              <button
                key={item.label}
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-primary/10 hover:text-primary"
                role="menuitem"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (item.command === "formatBlock") {
                    handleFormat(item.command, item.value);
                  } else {
                    handleFormat(item.command);
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const handleAiSubmit = async () => {
    if (!onAiModify) return;
    setAiLoading(true);
    try {
      const revised = await onAiModify(selectedText, aiInstruction.trim() || undefined);
      if (revised) {
        restoreSelection();
        document.execCommand("insertHTML", false, revised);
        editorRef.current?.focus();
        hide();
        setShowAiModal(false);
      }
    } finally {
      setAiLoading(false);
    }
  };

  return typeof document !== "undefined" ? (
    <>
      {createPortal(toolbar, document.body)}
      <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
        <DialogContent showCloseButton className="sm:max-w-sm p-4">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base">Ask for modification</DialogTitle>
          </DialogHeader>
          <Input
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            placeholder="e.g. Shorter, add examples"
            disabled={aiLoading}
            className="mt-3 h-9 border-slate-200 focus:ring-primary/30"
          />
          <DialogFooter className="gap-2 p-0 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAiModal(false)}
              disabled={aiLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAiSubmit}
              disabled={aiLoading}
            >
              {aiLoading ? "Modifying…" : "Modify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  ) : null;
}

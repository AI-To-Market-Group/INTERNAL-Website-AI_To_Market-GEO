"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function AiSelectionHelper({ containerRef }: Props) {
  /* ---- state ---- */
  const [btnStyle, setBtnStyle] = useState<React.CSSProperties | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogText, setDialogText] = useState("");
  const [prompt, setPrompt] = useState(
    "Rewrite this passage in a clearer, more impactful tone for a B2B article."
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  // Keep the captured text in a ref so it survives focus changes
  const capturedTextRef = useRef("");
  const isFloatingVisible = useRef(false);

  const hideFloating = useCallback(() => {
    setBtnStyle(null);
    capturedTextRef.current = "";
    isFloatingVisible.current = false;
  }, []);

  /* ---- listen for text selection ---- */
  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      // If the click was on our floating button, don't interfere
      const target = e.target as HTMLElement;
      if (target.closest("[data-ai-floating-btn]")) return;

      // If dialog is open, ignore
      if (dialogOpen) return;

      // Small delay to let the browser finalize the selection
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          hideFloating();
          return;
        }

        const text = sel.toString().trim();
        if (!text) {
          hideFloating();
          return;
        }

        const container = containerRef.current;
        if (!container) return;

        const range = sel.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) {
          hideFloating();
          return;
        }

        const rect = range.getBoundingClientRect();
        capturedTextRef.current = text;
        isFloatingVisible.current = true;
        setBtnStyle({
          position: "fixed" as const,
          left: rect.left + rect.width / 2,
          top: rect.top - 10,
          transform: "translate(-50%, -100%)",
          zIndex: 9999,
        });
      });
    }

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [containerRef, hideFloating, dialogOpen]);

  /* ---- floating button click → open dialog ---- */
  const handleFloatingClick = useCallback(() => {
    // Snapshot the text from ref BEFORE dialog opens & clears selection
    const text = capturedTextRef.current;
    if (!text) return;

    setDialogText(text);
    setResult("");
    setDialogOpen(true);
    setBtnStyle(null);
    isFloatingVisible.current = false;
  }, []);

  /* ---- call OpenAI ---- */
  const handleAsk = async () => {
    if (!dialogText.trim() || !prompt.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: dialogText, prompt }),
      });
      if (!res.ok) {
        const t = await res.text();
        setResult(`API error (${res.status}): ${t || "see server logs"}`);
      } else {
        const data = (await res.json()) as { suggestion?: string };
        setResult(data.suggestion ?? "");
      }
    } catch (err) {
      setResult(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button above selection */}
      {btnStyle && capturedTextRef.current && (
        <button
          type="button"
          data-ai-floating-btn
          onMouseDown={(e) => {
            // Prevent browser from collapsing the selection
            e.preventDefault();
          }}
          onClick={handleFloatingClick}
          style={btnStyle}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Edit with AI
        </button>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit with AI</DialogTitle>
            <DialogDescription>
              Select text in the article, enter your prompt, and get a suggestion.
              You can then copy/paste the result directly into the Markdown.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selected text (read-only) */}
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">
                Selected text
              </p>
              <div className="max-h-40 min-h-[2.5rem] overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap">
                {dialogText || "(no text)"}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                AI prompt (instruction)
              </label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* AI result */}
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">
                AI suggestion
              </p>
              <div className="max-h-48 min-h-[2.5rem] overflow-y-auto rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap select-all">
                {loading
                  ? "Generating…"
                  : result || "The result will appear here."}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleAsk}
              disabled={loading || !dialogText.trim()}
            >
              {loading ? "In progress…" : "Generate a suggestion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

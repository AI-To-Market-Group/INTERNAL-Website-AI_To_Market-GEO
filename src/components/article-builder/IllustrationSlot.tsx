"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, RefreshCw, X } from "lucide-react";
import type { IllustrationSurface } from "@/lib/illustration-generator";

interface IllustrationSlotProps {
  /** Article title — used as the generation prompt's title field */
  title: string;
  /** Outline-derived sections summary for the generation prompt */
  summary?: string;
  surface?: IllustrationSurface;
  /** Opportunity ID used to persist the generated URL across page navigations */
  opportunityId?: string;
}

interface IllustrationCache {
  url: string;
  title: string;
  summary: string;
}

export function IllustrationSlot({
  title,
  summary = "",
  surface = "light",
  opportunityId,
}: IllustrationSlotProps) {
  const [cdnUrl,     setCdnUrl]    = useState<string | null>(null);
  const [loading,    setLoading]   = useState(false);
  const [error,      setError]     = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const initFiredRef  = useRef(false);

  const generate = useCallback(async (customSummary?: string) => {
    setLoading(true);
    setError(null);
    setPromptOpen(false);
    try {
      const res = await fetch("/api/illustration-generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title,
          summary: customSummary ?? summary,
          surface,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      }
      const { cdnUrl: url } = (await res.json()) as { cdnUrl: string };
      setCdnUrl(url);
      if (opportunityId) {
        try {
          // Cache stores title + summary so we can detect stale entries later
          const cache: IllustrationCache = { url, title, summary };
          localStorage.setItem(`ill2_${opportunityId}`, JSON.stringify(cache));
        } catch {}
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [title, summary, surface, opportunityId]);

  // On mount: restore valid cache (matching title+summary) OR auto-generate
  useEffect(() => {
    if (initFiredRef.current) return;
    initFiredRef.current = true;

    if (opportunityId) {
      try {
        const raw = localStorage.getItem(`ill2_${opportunityId}`);
        if (raw) {
          const cached = JSON.parse(raw) as IllustrationCache;
          if (cached.title === title && cached.summary === summary) {
            setCdnUrl(cached.url);
            return; // valid cache hit — don't regenerate
          }
          // Stale: title or outline changed — clear and regenerate
          localStorage.removeItem(`ill2_${opportunityId}`);
        }
      } catch {}
    }

    // No valid cache — auto-generate immediately
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPrompt() {
    setCustomText("");
    setPromptOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 40);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = customText.trim();
    if (text) generate(text);
  }

  // ── Loading / empty state (before first image) ────────────────────────────
  if (!cdnUrl) {
    return (
      <div className="mb-6 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-white py-10">
        {loading ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
            <p className="text-sm text-slate-400">Generating illustration…</p>
          </>
        ) : (
          <>
            {error && (
              <p className="max-w-xs text-center text-xs text-red-500">{error}</p>
            )}
            <ImageIcon className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">No illustration yet</p>
            <button
              type="button"
              onClick={() => generate()}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Generate illustration
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Populated state ───────────────────────────────────────────────────────
  return (
    <div className="group relative mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        className={`flex cursor-pointer items-center justify-center py-6 transition-opacity ${
          promptOpen ? "cursor-default" : ""
        }`}
        onClick={!promptOpen && !loading ? openPrompt : undefined}
        role={!promptOpen && !loading ? "button" : undefined}
        aria-label="Click to regenerate with a custom description"
      >
        <img
          src={cdnUrl}
          alt="Article illustration"
          className={`block transition-opacity duration-200 ${
            loading ? "opacity-25" : promptOpen ? "opacity-20" : "group-hover:opacity-75"
          }`}
          style={{ imageRendering: "crisp-edges" }}
        />
      </div>

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          <p className="text-xs text-slate-500">Regenerating…</p>
        </div>
      )}

      {!loading && !promptOpen && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900/75 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </span>
        </div>
      )}

      {promptOpen && !loading && (
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-sm"
        >
          <p className="mb-2 text-xs font-semibold text-slate-600">
            Describe the illustration you want
          </p>
          <textarea
            ref={textareaRef}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); }
              if (e.key === "Escape") setPromptOpen(false);
            }}
            placeholder='e.g. "A shield icon representing enterprise security"'
            rows={2}
            className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPromptOpen(false)}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={!customText.trim()}
              className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
            >
              Generate
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

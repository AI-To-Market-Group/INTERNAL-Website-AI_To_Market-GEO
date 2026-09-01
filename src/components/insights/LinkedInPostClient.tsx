"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Linkedin,
  Pencil,
  Eye,
  Save,
  Check,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { InsightDoc, InsightFrontmatter } from "@/lib/insights/shared";
import { CATEGORY_LABELS } from "@/lib/insights/shared";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) parts.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={key++}>{match[4]}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function RenderLinkedInBody({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }

    if (t.startsWith("- ") || t.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const li = lines[i].trim();
        if (!li.startsWith("- ") && !li.startsWith("* ")) break;
        items.push(li.slice(2).trim());
        i++;
      }
      elements.push(
        <ul key={key++} className="my-1 list-disc pl-5 space-y-0.5">
          {items.map((it, j) => <li key={j}>{renderText(it)}</li>)}
        </ul>
      );
      continue;
    }

    // Hashtags line
    if (t.startsWith("#") && !t.startsWith("# ")) {
      elements.push(
        <p key={key++} className="mt-3 text-[#0A66C2] font-medium text-xs">
          {t}
        </p>
      );
      i++;
      continue;
    }

    elements.push(<p key={key++} className="my-1">{renderText(t)}</p>);
    i++;
  }

  return <>{elements}</>;
}

interface Props {
  article: InsightDoc;
  parent?: InsightFrontmatter | null;
}

export default function LinkedInPostClient({ article, parent }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [markdown, setMarkdown] = useState(article.markdown);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(article.title);
  const [savingTitle, setSavingTitle] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isNew = article.title.startsWith("New");
  const displayTitle = title.replace(/^New:\s*/i, "");

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/insights/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: article.slug, markdown }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally { setSaving(false); }
  }, [article.slug, markdown]);

  const handleSaveTitle = useCallback(async () => {
    if (!title.trim() || title === article.title) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      await fetch("/api/insights/update-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: article.slug, title }),
      });
      setEditingTitle(false);
      router.refresh();
    } finally { setSavingTitle(false); }
  }, [article.slug, article.title, title, router]);

  const handleDelete = useCallback(async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/insights/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: article.slug }),
      });
      if (res.ok) {
        try { localStorage.removeItem(`article-preview:${article.slug}`); } catch { /* ignore */ }
        router.push("/content-forge");
      }
    } finally { setDeleteLoading(false); }
  }, [article.slug, router]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/content-forge"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Content Forge
        </Link>
      </div>

      {/* LinkedIn card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A66C2] text-white">
            <Linkedin className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm font-semibold outline-none focus:border-primary"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") { setTitle(article.title); setEditingTitle(false); }
                  }}
                />
                <Button size="icon-xs" onClick={handleSaveTitle} disabled={savingTitle}>
                  {savingTitle ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
              </div>
            ) : (
              <p
                className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary/80 group"
                onClick={() => setEditingTitle(true)}
              >
                {displayTitle}
                <Pencil className="ml-1 inline h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100" />
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDate(article.dateISO)}
              {isNew && (
                <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                  New
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Body */}
        {mode === "edit" ? (
          <div className="px-5 py-4">
            <textarea
              className="min-h-[180px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
            />
          </div>
        ) : (
          <div className="px-5 py-4 text-sm text-slate-800 leading-relaxed">
            <RenderLinkedInBody text={markdown} />
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          <Button variant={mode === "view" ? "ghost" : "outline"} size="xs" onClick={() => setMode("view")}>
            <Eye className="mr-1 h-3 w-3" /> View
          </Button>
          <Button variant={mode === "edit" ? "ghost" : "outline"} size="xs" onClick={() => setMode("edit")}>
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
          {mode === "edit" && (
            <Button size="xs" onClick={handleSave} disabled={saving}>
              {saved ? <><Check className="mr-1 h-3 w-3" /> OK</> : <><Save className="mr-1 h-3 w-3" /> {saving ? "…" : "Save"}</>}
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="xs"
            onClick={() => setConfirmDelete(true)}
            className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      </div>

      {/* Dependency link */}
      {parent && (
        <Link
          href={`/content-forge/${parent.slug}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          From: {CATEGORY_LABELS[parent.category]} — {parent.title.replace(/^New:\s*/i, "")}
        </Link>
      )}

      {/* Delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

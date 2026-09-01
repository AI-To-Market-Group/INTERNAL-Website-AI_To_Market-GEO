"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { WP_CATEGORIES } from "@/lib/article-builder-utils";
import type { InsightCmsMetadata } from "@/lib/insights/shared";

function defaultCmsMetadata(title: string): InsightCmsMetadata {
  return {
    title,
    slug: title
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, ""),
    excerpt: "",
    category: WP_CATEGORIES[0],
    tags: [],
    focus_keyword: "",
    seo_title: "",
    seo_description: "",
  };
}

interface CmsMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  articleTitle: string;
  cmsMetadata?: InsightCmsMetadata | null;
  onSaved?: () => void;
}

export function CmsMetadataDialog({
  open,
  onOpenChange,
  slug,
  articleTitle,
  cmsMetadata,
  onSaved,
}: CmsMetadataDialogProps) {
  const meta = cmsMetadata ?? defaultCmsMetadata(articleTitle);
  const [local, setLocal] = useState<InsightCmsMetadata>(meta);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setLocal(meta);
  }, [open, meta]);

  const update = useCallback((upd: Partial<InsightCmsMetadata>) => {
    setLocal((p) => ({ ...p, ...upd }));
  }, []);

  const addTag = useCallback(() => {
    const t = newTag.trim();
    const tags = local.tags ?? [];
    if (!t || tags.includes(t)) return;
    setLocal((p) => ({ ...p, tags: [...tags, t] }));
    setNewTag("");
  }, [local.tags, newTag]);

  const removeTag = useCallback((tag: string) => {
    setLocal((p) => ({ ...p, tags: (p.tags ?? []).filter((x) => x !== tag) }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/insights/update-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, cmsMetadata: local }),
      });
      if (res.ok) {
        onSaved?.();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  }, [slug, local, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>CMS / Metadata</DialogTitle>
          <DialogDescription>
            SEO and publication metadata for Webflow, WordPress, or other CMS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <Input
              value={local.title}
              onChange={(e) => update({ title: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
            <Input
              value={local.slug}
              onChange={(e) => update({ slug: e.target.value })}
              className="w-full font-mono text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Excerpt</label>
            <textarea
              value={local.excerpt}
              onChange={(e) => update({ excerpt: e.target.value })}
              rows={2}
              className="w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <select
              value={local.category}
              onChange={(e) => update({ category: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {WP_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tags</label>
            <div className="flex flex-wrap gap-1">
              {(local.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              <div className="flex gap-1">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="New tag"
                  className="h-7 w-28 text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  Add
                </Button>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              SEO title (≤ 60 chars)
            </label>
            <Input
              value={local.seo_title ?? ""}
              onChange={(e) => update({ seo_title: e.target.value })}
              placeholder="Title for search results"
              maxLength={60}
              className="w-full"
            />
            <p className="mt-0.5 text-xs text-slate-400">{(local.seo_title ?? "").length}/60</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Meta description (≤ 160 chars)
            </label>
            <textarea
              value={local.seo_description ?? ""}
              onChange={(e) => update({ seo_description: e.target.value })}
              rows={2}
              placeholder="Description for search results"
              maxLength={160}
              className="w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-0.5 text-xs text-slate-400">
              {(local.seo_description ?? "").length}/160
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

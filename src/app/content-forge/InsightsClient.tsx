"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useCallback, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import {
  ArrowDownWideNarrow,
  Plus,
  Sparkles,
  BookOpen,
  Linkedin,
  MessageCircle,
  Globe,
  ArrowRight,
  Trash2,
} from "lucide-react";
import type {
  InsightFrontmatter,
  InsightCategory,
  InsightDoc,
} from "@/lib/insights/shared";
import { CATEGORY_LABELS } from "@/lib/insights/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImagePlaceholder } from "@/components/insights/ImagePlaceholder";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SortMode = "newest" | "oldest";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const TAB_ICONS: Record<InsightCategory, React.ReactNode> = {
  blog: <BookOpen className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  reddit: <MessageCircle className="h-4 w-4" />,
  wikipedia: <Globe className="h-4 w-4" />,
};

const TABS: InsightCategory[] = ["blog", "linkedin", "reddit", "wikipedia"];

const SESSION_PREVIEW_PREFIX = "article-preview:";
const LAST_CREATED_SLUG_KEY = "insights-last-created-slug";

function readSessionPreviewFrontmatters(): InsightFrontmatter[] {
  try {
    const storage = typeof window !== "undefined" ? localStorage : null;
    if (!storage) return [];
    const out: InsightFrontmatter[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(SESSION_PREVIEW_PREFIX)) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      try {
        const doc = JSON.parse(raw) as InsightDoc;
        const { markdown: _discard, ...frontmatter } = doc;
        out.push(frontmatter as InsightFrontmatter);
      } catch {
        // ignore parse errors
      }
    }
    return out;
  } catch {
    return [];
  }
}

export default function InsightsClient({
  items,
}: {
  items: InsightFrontmatter[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<InsightCategory>("blog");
  const [sort, setSort] = useState<SortMode>("newest");
  const [sessionItems, setSessionItems] = useState<InsightFrontmatter[]>([]);

  const mergedItems = useMemo(() => {
    // Prefer server items when both exist, but still show session previews
    const bySlug = new Map<string, InsightFrontmatter>();
    for (const s of sessionItems) bySlug.set(s.slug, s);
    for (const it of items) bySlug.set(it.slug, it);
    return Array.from(bySlug.values());
  }, [items, sessionItems]);

  useEffect(() => {
    const sessionPreview = readSessionPreviewFrontmatters();
    setSessionItems(sessionPreview);
  }, [items]);

  // Create with AI dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Delete confirmation
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Counts per category
  const counts = useMemo(() => {
    const c: Record<InsightCategory, number> = {
      blog: 0,
      linkedin: 0,
      reddit: 0,
      wikipedia: 0,
    };
    for (const a of mergedItems) c[a.category] = (c[a.category] || 0) + 1;
    return c;
  }, [mergedItems]);

  // Parent title lookup (for dependency display)
  const parentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of mergedItems) m.set(a.slug, a.title);
    return m;
  }, [mergedItems]);

  // Filtered + sorted items
  const filtered = useMemo(() => {
    const out = mergedItems.filter((a) => a.category === activeTab);
    out.sort((a, b) => {
      const da = new Date(a.dateISO).getTime();
      const db = new Date(b.dateISO).getTime();
      return sort === "newest" ? db - da : da - db;
    });
    return out;
  }, [mergedItems, activeTab, sort]);

  // Create blank article
  const handleCreateBlank = useCallback(async () => {
    const title =
      activeTab === "linkedin"
        ? "New: New LinkedIn post"
        : activeTab === "reddit"
          ? "New: New Reddit post"
          : activeTab === "wikipedia"
            ? "New: New Wikipedia-style article"
            : "New: New blog article";

    const markdown = "";
    const res = await fetch("/api/insights/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category: activeTab, markdown }),
    });
    if (res.ok) {
      const data = (await res.json()) as { slug: string };
      try {
        localStorage.setItem(`article-preview:${data.slug}`, JSON.stringify({
          slug: data.slug, title, category: activeTab, type: "Article",
          dateISO: new Date().toISOString().slice(0, 10), readTimeMin: 3, markdown,
        }));
        localStorage.setItem(LAST_CREATED_SLUG_KEY, data.slug);
        setSessionItems(readSessionPreviewFrontmatters());
      } catch { /* localStorage unavailable */ }
      router.push(`/content-forge/${data.slug}`);
    }
  }, [activeTab, router]);

  // Create with AI
  const handleCreateWithAi = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          category: activeTab,
          prompt: aiPrompt.trim(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          slugs: string[];
          articles?: { slug: string; title: string; category: string; markdown: string; excerpt?: string }[];
        };
        setAiDialogOpen(false);
        setAiPrompt("");
        if (data.articles) {
          for (const a of data.articles) {
            try {
              localStorage.setItem(`article-preview:${a.slug}`, JSON.stringify({
                slug: a.slug, title: a.title, category: a.category, type: "Article",
                dateISO: new Date().toISOString().slice(0, 10), readTimeMin: 3,
                excerpt: a.excerpt, markdown: a.markdown,
              }));
            } catch { /* localStorage unavailable */ }
          }
        }
        if (data.slugs?.length) {
          try { localStorage.setItem(LAST_CREATED_SLUG_KEY, data.slugs[0]); } catch { /* ignore */ }
        }
        setSessionItems(readSessionPreviewFrontmatters());

        if (data.slugs.length === 1) {
          router.push(`/content-forge/${data.slugs[0]}`);
        }
      }
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, activeTab, router]);

  // Delete article
  const handleDelete = useCallback(async () => {
    if (!deleteSlug) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/insights/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: deleteSlug }),
      });
      if (res.ok) {
        setDeleteSlug(null);
        router.refresh();
        toast.success("Article deleted");
        try {
          localStorage.removeItem(`article-preview:${deleteSlug}`);
          const lastSlug = localStorage.getItem(LAST_CREATED_SLUG_KEY);
          if (lastSlug === deleteSlug) localStorage.removeItem(LAST_CREATED_SLUG_KEY);
        } catch { /* ignore */ }
        setSessionItems(readSessionPreviewFrontmatters());
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message ?? "Couldn't delete this article.");
        setDeleteSlug(null);
      }
    } finally {
      setDeleting(false);
    }
  }, [deleteSlug, router]);

  return (
    <div>
      <Header />
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Content Forge
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            All your content in one place — blog articles, LinkedIn posts,
            Reddit threads, and Wikipedia-style entries.
          </p>
        </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
              activeTab === tab
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {TAB_ICONS[tab]}
            {CATEGORY_LABELS[tab]}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold",
                activeTab === tab
                  ? "bg-primary/10 text-primary"
                  : "bg-slate-200 text-slate-500"
              )}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Actions bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleCreateBlank}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New article
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAiDialogOpen(true)}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Create with AI
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setSort((s) => (s === "newest" ? "oldest" : "newest"))
            }
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <ArrowDownWideNarrow className="h-4 w-4" />
            {sort === "newest" ? "Newest" : "Oldest"}
          </button>
          <span className="text-sm text-muted-foreground">
            {filtered.length} result{filtered.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Cards grid — compact list for LinkedIn, full cards for others */}
      {activeTab === "linkedin" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((a) => (
            <div key={a.slug} className="group relative">
              <Link href={`/content-forge/${a.slug}`}>
                <Card className="gap-0 overflow-hidden p-0 transition-shadow group-hover:shadow-md">
                  <div className="flex items-start gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A66C2] text-white">
                      <Linkedin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 line-clamp-1 pr-6">
                          {a.title.replace(/^New:\s*/i, "")}
                        </span>
                        {a.title.startsWith("New") && (
                          <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                            New
                          </span>
                        )}
                      </div>
                      {a.excerpt && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {a.excerpt}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>{formatDate(a.dateISO)}</span>
                        {a.parentSlug && parentMap.has(a.parentSlug) && (
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <ArrowRight className="h-2.5 w-2.5" />
                            <span className="truncate max-w-[200px]">
                              {parentMap.get(a.parentSlug)?.replace(/^New:\s*/i, "")}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
              <button
                type="button"
                title="Delete"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteSlug(a.slug);
                  setDeleteTitle(a.title.replace(/^New:\s*/i, ""));
                }}
                className="absolute right-2 top-2 z-10 rounded-full border border-slate-200 bg-white p-1 text-slate-400 opacity-0 shadow-sm transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <div key={a.slug} className="group relative">
              <Link href={`/content-forge/${a.slug}`}>
                <Card className="gap-0 overflow-hidden p-0 transition-shadow group-hover:shadow-md">
                  <div className="p-6">
                    {a.title.startsWith("New") && (
                      <span className="mb-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                        New
                      </span>
                    )}
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {CATEGORY_LABELS[a.category]}
                    </div>
                    <div className="mt-3 text-lg font-bold leading-snug text-slate-900 pr-8">
                      {a.title.replace(/^New:\s*/i, "")}
                    </div>
                    {a.excerpt && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {a.excerpt}
                      </p>
                    )}
                    {a.parentSlug && parentMap.has(a.parentSlug) && (
                      <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
                        <ArrowRight className="h-3 w-3" />
                        <span className="truncate">
                          From: {parentMap.get(a.parentSlug)?.replace(/^New:\s*/i, "")}
                        </span>
                      </div>
                    )}
                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <div className="text-xs font-semibold text-slate-500">
                        {formatDate(a.dateISO)}
                        {a.readTimeMin ? ` · ${a.readTimeMin} min read` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 pb-6">
                    <ImagePlaceholder className="aspect-[16/10]" label="Image" />
                  </div>
                </Card>
              </Link>
              <button
                type="button"
                title="Delete"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteSlug(a.slug);
                  setDeleteTitle(a.title.replace(/^New:\s*/i, ""));
                }}
                className="absolute right-3 top-3 z-10 rounded-full border border-slate-200 bg-white p-1.5 text-slate-400 opacity-0 shadow-sm transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="mt-12 text-center text-muted-foreground">
          No content in this section yet.
        </div>
      )}

      {/* Create with AI Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Create with AI
            </DialogTitle>
            <DialogDescription>
              Describe the topic or paste source text. AI will generate a{" "}
              {activeTab === "linkedin" ? "LinkedIn post" : activeTab === "reddit" ? "Reddit post" : activeTab === "wikipedia" ? "Wikipedia-style article" : "blog article"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <textarea
              className="w-full min-h-[120px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="E.g. Write an article on the impact of AI in retail in 2026..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiDialogOpen(false)}
              disabled={aiLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateWithAi}
              disabled={aiLoading || !aiPrompt.trim()}
            >
              {aiLoading ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteSlug} onOpenChange={(v) => { if (!v) setDeleteSlug(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this article?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The article will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {deleteTitle}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteSlug(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

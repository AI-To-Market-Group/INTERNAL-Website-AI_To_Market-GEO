"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Save,
  Pencil,
  Eye,
  Check,
  Sparkles,
  BookOpen,
  Linkedin,
  ArrowRight,
  Loader2,
  Trash2,
  Database,
  Download,
  ImageIcon,
  Upload,
  X,
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
import { toast } from "sonner";
import { ImagePlaceholder } from "@/components/insights/ImagePlaceholder";
import { CmsMetadataDialog } from "@/components/insights/CmsMetadataDialog";
import { AiSelectionHelper } from "@/components/insights/AiSelectionHelper";
import { ContentGenerationChat } from "@/components/article-builder/ContentGenerationChat";
import type { InsightDoc, InsightFrontmatter } from "@/lib/insights/shared";
import { CATEGORY_LABELS } from "@/lib/insights/shared";

/* ------------------------------------------------------------------ */
/*  Date formatting                                                    */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Inline markdown                                                    */
/* ------------------------------------------------------------------ */

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1])
      parts.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3])
      parts.push(<em key={key++}>{match[4]}</em>);
    else if (match[5])
      parts.push(
        <a
          key={key++}
          href={match[7]}
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[6]}
        </a>
      );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ------------------------------------------------------------------ */
/*  Markdown parser                                                    */
/* ------------------------------------------------------------------ */

type MdNode =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "blockquote"; lines: string[] }
  | { type: "img"; alt: string; src: string }
  | { type: "hr" };

function parseMd(md: string): MdNode[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: MdNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const t = lines[i].trim();

    if (!t) { i++; continue; }
    if (t === "---") { out.push({ type: "hr" }); i++; continue; }
    if (t.startsWith("### ")) { out.push({ type: "h3", text: t.slice(4).trim() }); i++; continue; }
    if (t.startsWith("## ")) { out.push({ type: "h2", text: t.slice(3).trim() }); i++; continue; }
    if (t.startsWith("# ")) { out.push({ type: "h1", text: t.slice(2).trim() }); i++; continue; }

    const imgMatch = t.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) { out.push({ type: "img", alt: imgMatch[1] || "Image", src: imgMatch[2] || "" }); i++; continue; }

    if (t.startsWith("> ")) {
      const qLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        qLines.push(lines[i].trim().slice(2).trim());
        i++;
      }
      out.push({ type: "blockquote", lines: qLines });
      continue;
    }

    if (t.startsWith("- ") || t.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const li = lines[i].trim();
        if (!li.startsWith("- ") && !li.startsWith("* ")) break;
        items.push(li.slice(2).trim());
        i++;
      }
      out.push({ type: "ul", items });
      continue;
    }

    const buf: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || l.startsWith("#") || l.startsWith("- ") || l.startsWith("* ") || l.startsWith("> ") || l.match(/^!\[.*\]\(.*\)$/) || l === "---") break;
      buf.push(l);
      i++;
    }
    if (buf.length) out.push({ type: "p", text: buf.join(" ") });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/*  Render markdown nodes                                              */
/* ------------------------------------------------------------------ */

function RenderMarkdown({ markdown }: { markdown: string }) {
  const nodes = parseMd(markdown);
  return (
    <div className="space-y-5">
      {nodes.map((n, idx) => {
        switch (n.type) {
          case "h1":
            return <h1 key={idx} className="text-3xl font-bold text-foreground">{renderInline(n.text)}</h1>;
          case "h2":
            return <h2 key={idx} className="text-2xl font-bold text-foreground mt-8">{renderInline(n.text)}</h2>;
          case "h3":
            return <h3 key={idx} className="text-xl font-semibold text-foreground mt-6">{renderInline(n.text)}</h3>;
          case "hr":
            return <hr key={idx} className="border-slate-200 my-6" />;
          case "p":
            return <p key={idx} className="text-slate-700 leading-relaxed">{renderInline(n.text)}</p>;
          case "ul":
            return (
              <ul key={idx} className="list-disc pl-6 text-slate-700 space-y-1.5">
                {n.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
              </ul>
            );
          case "blockquote":
            return (
              <blockquote key={idx} className="border-l-4 border-primary bg-primary/5 rounded-r-lg px-5 py-4 my-4">
                {n.lines.map((l, j) => (
                  <p key={j} className="text-foreground font-medium leading-relaxed italic">
                    {renderInline(l)}
                  </p>
                ))}
              </blockquote>
            );
          case "img":
            if (n.src) {
              return (
                <figure key={idx} className="space-y-2 my-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={n.src} alt={n.alt} className="w-full rounded-xl border border-slate-200" />
                </figure>
              );
            }
            return (
              <figure key={idx} className="space-y-2 my-4">
                <ImagePlaceholder className="aspect-[16/9]" label={n.alt} />
              </figure>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

interface Props {
  article: InsightDoc;
  parent?: InsightFrontmatter | null;
}

export default function InsightArticleClient({ article, parent }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [markdown, setMarkdown] = useState(article.markdown);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(article.title);
  const [savingTitle, setSavingTitle] = useState(false);

  // Hero image
  const [heroImage, setHeroImage] = useState(article.heroImage ?? "");
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingInline, setUploadingInline] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const inlineFileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate dialogs
  const [genBlogsOpen, setGenBlogsOpen] = useState(false);
  const [genLinkedinOpen, setGenLinkedinOpen] = useState(false);
  const [genCount, setGenCount] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState(false);

  /* ---- Save markdown ---- */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/insights/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: article.slug, markdown }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }, [article.slug, markdown]);

  /* ---- Save title ---- */
  const handleSaveTitle = useCallback(async () => {
    if (!title.trim() || title === article.title) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      await fetch("/api/insights/update-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: article.slug, title }),
      });
      setEditingTitle(false);
      router.refresh();
    } finally {
      setSavingTitle(false);
    }
  }, [article.slug, article.title, title, router]);

  /* ---- Generate blogs from this press release ---- */
  const handleGenerateBlogs = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-blogs",
          sourceSlug: article.slug,
          sourceTitle: article.title,
          sourceMarkdown: article.markdown,
          count: genCount,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          slugs: string[];
          articles?: { slug: string; title: string; category: string; markdown: string; excerpt?: string; parentSlug?: string }[];
        };
        if (data.articles) {
          for (const a of data.articles) {
            try {
              localStorage.setItem(`article-preview:${a.slug}`, JSON.stringify({
                slug: a.slug, title: a.title, category: a.category, type: "Article",
                dateISO: new Date().toISOString().slice(0, 10), readTimeMin: 3,
                excerpt: a.excerpt, parentSlug: a.parentSlug, markdown: a.markdown,
              }));
            } catch { /* localStorage unavailable */ }
          }
        }
        setGenBlogsOpen(false);
        router.push("/content-forge");
      }
    } finally {
      setGenerating(false);
    }
  }, [article.slug, article.title, article.markdown, genCount, router]);

  /* ---- Generate linkedin posts from this blog ---- */
  const handleGenerateLinkedin = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-linkedin",
          sourceSlug: article.slug,
          sourceTitle: article.title,
          sourceMarkdown: article.markdown,
          count: genCount,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          slugs: string[];
          articles?: { slug: string; title: string; category: string; markdown: string; excerpt?: string; parentSlug?: string }[];
        };
        if (data.articles) {
          for (const a of data.articles) {
            try {
              localStorage.setItem(`article-preview:${a.slug}`, JSON.stringify({
                slug: a.slug, title: a.title, category: a.category, type: "Article",
                dateISO: new Date().toISOString().slice(0, 10), readTimeMin: 3,
                excerpt: a.excerpt, parentSlug: a.parentSlug, markdown: a.markdown,
              }));
            } catch { /* localStorage unavailable */ }
          }
        }
        setGenLinkedinOpen(false);
        router.push("/content-forge");
      }
    } finally {
      setGenerating(false);
    }
  }, [article.slug, article.title, article.markdown, genCount, router]);

  /* ---- Generate with AI: article for AI To Market ---- */
  const handleGenerateWithAI = useCallback(async () => {
    setGeneratingArticle(true);
    try {
      const topic = article.title.replace(/^New:\s*/i, "").trim() || "AI strategy and implementation";
      const prompt = `Write a blog article for AI To Market about: ${topic}. Use a B2B practitioner tone, structured with subheadings (##) and lists. Use Markdown. Focus on AI adoption in marketing, sales, or supply chain. Name specific tools (Claude, GPT-4o, n8n, Make) where relevant. Brand: AI To Market (AITOM) — AI strategy and implementation consultancy.`;
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          category: "blog",
          prompt,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          slugs?: string[];
          articles?: { slug: string; title: string; category: string; markdown: string; excerpt?: string }[];
        };
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
        const newSlug = data.slugs?.[0];
        if (newSlug) {
          router.push(`/content-forge/${newSlug}`);
        }
      }
    } finally {
      setGeneratingArticle(false);
    }
  }, [article.title, router]);

  /* ---- Upload hero image ---- */
  const handleHeroFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/insights/upload-image", { method: "POST", body: fd });
      const uploadData = (await uploadRes.json()) as { url?: string; error?: string };
      if (!uploadRes.ok || !uploadData.url) {
        toast.error(uploadData.error ?? "Upload failed");
        return;
      }
      const url = uploadData.url;
      // Persist to DB
      await fetch("/api/insights/update-hero-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: article.slug, heroImage: url }),
      });
      setHeroImage(url);
      router.refresh();
      toast.success("Hero image updated");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingHero(false);
      if (heroFileRef.current) heroFileRef.current.value = "";
    }
  }, [article.slug, router]);

  const handleRemoveHero = useCallback(async () => {
    setHeroImage("");
    await fetch("/api/insights/update-hero-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: article.slug, heroImage: "" }),
    });
    router.refresh();
    toast.success("Hero image removed");
  }, [article.slug, router]);

  /* ---- Insert inline image into markdown ---- */
  const handleInlineFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInline(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/insights/upload-image", { method: "POST", body: fd });
      const uploadData = (await uploadRes.json()) as { url?: string; error?: string };
      if (!uploadRes.ok || !uploadData.url) {
        toast.error(uploadData.error ?? "Upload failed");
        return;
      }
      const url = uploadData.url;
      const mdSnippet = `\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n`;
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart ?? markdown.length;
        const before = markdown.slice(0, start);
        const after = markdown.slice(start);
        setMarkdown(before + mdSnippet + after);
      } else {
        setMarkdown((prev) => prev + mdSnippet);
      }
      toast.success("Image inserted into markdown");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingInline(false);
      if (inlineFileRef.current) inlineFileRef.current.value = "";
    }
  }, [markdown]);

  /* ---- Delete this article ---- */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [cmsDialogOpen, setCmsDialogOpen] = useState(false);

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
    } finally {
      setDeleteLoading(false);
    }
  }, [article.slug, router]);

  /* ---- Export GEO-optimized .md file ---- */
  const handleExportGeoMd = useCallback(() => {
    const cleanTitle = title.replace(/^New:\s*/i, "").trim();
    const slug = article.slug;
    const now = new Date().toISOString().split("T")[0];
    const cms = article.cmsMetadata;

    const seoTitle = cms?.seo_title || cleanTitle;
    const seoDesc = cms?.seo_description || cms?.excerpt || "";
    const focusKw = cms?.focus_keyword || "";
    const tags = cms?.tags?.length ? cms.tags : [];

    const frontmatter = [
      "---",
      `title: "${seoTitle.replace(/"/g, '\\"')}"`,
      `slug: "${slug}"`,
      `date: "${now}"`,
      `description: "${seoDesc.replace(/"/g, '\\"')}"`,
      ...(focusKw ? [`focus_keyword: "${focusKw.replace(/"/g, '\\"')}"`] : []),
      ...(tags.length ? [`tags: [${tags.map(t => `"${t}"`).join(", ")}]`] : []),
      `schema_type: "Article"`,
      `speakable: true`,
      "---",
    ].join("\n");

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: seoTitle,
      description: seoDesc,
      datePublished: now,
      dateModified: now,
      author: { "@type": "Organization", name: "AI To Market" },
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: ["article h1", "article h2", ".article-summary", ".key-takeaway"],
      },
    }, null, 2);

    const hasFaq = /^#{1,3}\s*(faq|frequently asked|questions)/im.test(markdown);

    const parts = [
      frontmatter,
      "",
      `<!-- JSON-LD (paste into <head> or CMS structured data field) -->`,
      "<!--",
      `<script type="application/ld+json">`,
      jsonLd,
      `</script>`,
      "-->",
      "",
      markdown,
    ];

    if (!hasFaq) {
      parts.push(
        "",
        "---",
        "",
        "## Frequently Asked Questions",
        "",
        `### What is ${cleanTitle.split(/[:\-–—]/)[0].trim()}?`,
        "",
        `${seoDesc || `This article covers key insights about ${cleanTitle}.`}`,
        "",
        `### Why does this matter?`,
        "",
        `Understanding ${focusKw || cleanTitle.split(/[:\-–—]/)[0].trim()} helps businesses stay ahead in an evolving market and make data-driven decisions.`,
        "",
      );
    }

    const blob = new Blob([parts.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("GEO-optimized .md exported");
  }, [title, markdown, article.slug, article.cmsMetadata]);

  /* ---- Apply assistant suggestion to full markdown (Writing Assistant chat) ---- */
  const handleApplyFromAssistant = useCallback(
    async (instruction: string) => {
      const prompt =
        instruction.trim() ||
        "Rewrite this content in a clearer, more professional style, keeping the business meaning and overall structure.";
      try {
        const res = await fetch("/api/ai-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selection: markdown,
            prompt,
          }),
        });
        const data = (await res.json()) as { suggestion?: string; error?: string };
        if (!res.ok || !data.suggestion) {
          throw new Error(data.error || `API error (${res.status})`);
        }
        setMarkdown(data.suggestion);
        setMode("edit");
        toast.success("Markdown updated from the writing assistant.");
      } catch (err) {
        console.error(err);
        toast.error("Unable to update Markdown from the assistant.");
      }
    },
    [markdown]
  );

  const isNew = article.title.startsWith("New");
  const displayTitle = title.replace(/^New:\s*/i, "");

  /* ------------------------------------------------------------------ */
  /*  Standard article layout (press releases & blogs)                  */
  /* ------------------------------------------------------------------ */
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/content-forge"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Content Forge
        </Link>
      </div>

      {/* Category + date */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-0.5">
          {CATEGORY_LABELS[article.category]}
        </span>
        <span>|</span>
        <span>{formatDate(article.dateISO)}</span>
        {article.readTimeMin && (
          <>
            <span>|</span>
            <span>{article.readTimeMin} min read</span>
          </>
        )}
        {isNew && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 normal-case">
            New
          </span>
        )}
      </div>

      {/* Editable title */}
      {editingTitle ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-3xl font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTitle();
              if (e.key === "Escape") {
                setTitle(article.title);
                setEditingTitle(false);
              }
            }}
          />
          <Button size="sm" onClick={handleSaveTitle} disabled={savingTitle}>
            {savingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
        </div>
      ) : (
        <h1
          className="text-4xl font-bold leading-tight tracking-tight text-foreground cursor-pointer hover:text-primary/80 transition-colors group"
          onClick={() => setEditingTitle(true)}
          title="Click to edit title"
        >
          {displayTitle}
          <Pencil className="ml-2 inline h-5 w-5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </h1>
      )}

      {/* Dependency link */}
      {parent && (
        <Link
          href={`/content-forge/${parent.slug}`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          From: {CATEGORY_LABELS[parent.category]} — {parent.title.replace(/^New:\s*/i, "")}
        </Link>
      )}

      {/* Hero image zone */}
      <div className="mt-8">
        {/* Hidden file input */}
        <input
          ref={heroFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={handleHeroFileChange}
        />

        {heroImage ? (
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt="Hero"
              className="aspect-[16/9] w-full object-cover"
            />
            {/* Overlay buttons */}
            <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => heroFileRef.current?.click()}
                disabled={uploadingHero}
                className="inline-flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-slate-800 shadow hover:bg-white disabled:opacity-60"
              >
                {uploadingHero ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Change image
              </button>
              <button
                type="button"
                onClick={handleRemoveHero}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600/90 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-red-600"
              >
                <X className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => heroFileRef.current?.click()}
            disabled={uploadingHero}
            className="flex aspect-[16/9] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-60"
          >
            {uploadingHero ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <ImageIcon className="h-8 w-8" />
            )}
            <span className="text-sm font-medium">
              {uploadingHero ? "Uploading…" : "Click to add a hero image"}
            </span>
            <span className="text-xs text-slate-400">JPG, PNG, WebP, GIF, AVIF · max 10 MB</span>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          variant={mode === "view" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("view")}
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Read
        </Button>
        <Button
          variant={mode === "edit" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("edit")}
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit Markdown
        </Button>
        {mode === "edit" && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saved ? (
              <><Check className="mr-1.5 h-3.5 w-3.5" /> Saved</>
            ) : (
              <><Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}</>
            )}
          </Button>
        )}

        {/* Generate article with AI */}
        <Button
          variant="default"
          size="sm"
          onClick={handleGenerateWithAI}
          disabled={generatingArticle}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {generatingArticle ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          Generate with AI
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export GEO-optimized .md */}
        {article.category === "blog" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportGeoMd}
            className="gap-1.5"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export GEO .md
          </Button>
        )}

        {/* CMS / Metadata for blogs */}
        {article.category === "blog" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCmsDialogOpen(true)}
            className="gap-1.5"
          >
            <Database className="mr-1.5 h-3.5 w-3.5" />
            CMS / Metadata
          </Button>
        )}

        {/* Generate buttons based on category */}
        {(article.category === "blog" || article.category === "wikipedia") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setGenCount(2); setGenBlogsOpen(true); }}
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Generate blog articles
          </Button>
        )}
        {article.category === "blog" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setGenCount(2); setGenLinkedinOpen(true); }}
          >
            <Linkedin className="mr-1.5 h-3.5 w-3.5" />
            Generate LinkedIn posts
          </Button>
        )}

        {/* Delete button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {/* Hidden inline image input */}
      <input
        ref={inlineFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={handleInlineFileChange}
      />

      {/* Content area */}
      {mode === "edit" ? (
        <div className="mt-6">
          {/* Edit toolbar */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Edit the Markdown directly. Click &ldquo;Save&rdquo; to write to{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">
                content/insights/{article.slug}.md
              </code>
              .
            </p>
            <button
              type="button"
              onClick={() => inlineFileRef.current?.click()}
              disabled={uploadingInline}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-60"
            >
              {uploadingInline ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              {uploadingInline ? "Uploading…" : "Insert image"}
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="min-h-[500px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
          />
        </div>
      ) : (
        <div ref={contentRef} className="mt-6">
          <RenderMarkdown markdown={markdown} />
          <AiSelectionHelper containerRef={contentRef} />
        </div>
      )}

      {/* Source link */}
      {article.sourceUrl && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-600">
            Source:{" "}
            <span className="font-mono text-xs">{article.sourceUrl}</span>
          </div>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Open source
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      <ContentGenerationChat
        isOpen={chatOpen}
        onOpenChange={setChatOpen}
        topicTitle={article.title}
        step={2}
        storageKey={`insight-chat:${article.slug}`}
        outlineSummary=""
        draftSummary=""
        onApplyToSelection={handleApplyFromAssistant}
      />

      {/* ---- Generate Blogs Dialog ---- */}
      <Dialog open={genBlogsOpen} onOpenChange={setGenBlogsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate blog articles</DialogTitle>
            <DialogDescription>
              AI will read this press release and generate blog articles with different angles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Number of articles to generate
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGenCount(n)}
                  className={`flex-1 rounded-lg border-2 py-2 text-center text-sm font-bold transition-colors ${
                    genCount === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setGenBlogsOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleGenerateBlogs} disabled={generating}>
              {generating ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate {genCount} article{genCount > 1 ? "s" : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Generate LinkedIn Dialog ---- */}
      <Dialog open={genLinkedinOpen} onOpenChange={setGenLinkedinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate LinkedIn posts</DialogTitle>
            <DialogDescription>
              AI will read this blog article and create impactful LinkedIn posts with different tones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Number of posts to generate
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGenCount(n)}
                  className={`flex-1 rounded-lg border-2 py-2 text-center text-sm font-bold transition-colors ${
                    genCount === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setGenLinkedinOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleGenerateLinkedin} disabled={generating}>
              {generating ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate {genCount} post{genCount > 1 ? "s" : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirmation Dialog ---- */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this article?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The Markdown file will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {displayTitle}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- CMS / Metadata Dialog (blogs) ---- */}
      <CmsMetadataDialog
        open={cmsDialogOpen}
        onOpenChange={setCmsDialogOpen}
        slug={article.slug}
        articleTitle={article.title}
        cmsMetadata={article.cmsMetadata}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

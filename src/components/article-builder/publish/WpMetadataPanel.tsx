"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check,
  Loader2,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Stethoscope,
  Wrench,
  AlertTriangle,
  FileText,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { WP_CATEGORIES } from "@/lib/article-builder-utils";
import type { WordPressMetadata, GeoScore, GeoCheck, BrandVoiceStatus } from "@/types";

// ── Card 1: Quality checks ────────────────────────────────────────────────────

interface CheckDiagnosis {
  problem: string;
  suggestion: string;
}

function diagnoseCheck(check: GeoCheck): CheckDiagnosis {
  const ev = check.evidence ?? "";
  switch (check.label) {
    case "Statistics with sources": {
      const m = ev.match(/^(\d+) sourced/);
      const n = m ? parseInt(m[1]) : 0;
      return {
        problem: n === 0
          ? "No numeric statistics found with source attribution."
          : `Only ${n} attributed statistic — need at least 2.`,
        suggestion: n === 0
          ? 'Add two specific figures with "per Source (Year)" attribution.'
          : 'Add one more cited number, e.g. "68% of B2B buyers prefer cited content, per Gartner (2024)".',
      };
    }
    case "Named sources": {
      const isGeneric = ev.includes("generic");
      const isNone = ev.includes("No source");
      return {
        problem: isNone
          ? "No named source attributions found."
          : isGeneric
          ? "Only generic phrases ('studies show') — no named organisations cited."
          : "Fewer than 2 named source attributions found.",
        suggestion: 'Add "per Organisation (Year)" or "according to Organisation" to at least 2 claims.',
      };
    }
    case "Cited claims":
      return {
        problem: "No quoted text or inline attribution found.",
        suggestion: 'Add a cited passage: "claim text" — Source, Year or "according to Source".',
      };
    case "AI-tell density": {
      const m = ev.match(/:\s*(.+)$/);
      return {
        problem: `AI-generated phrasing detected: ${m?.[1] ?? ev}`,
        suggestion: "Replace the flagged phrases with specific, direct language.",
      };
    }
    case "FAQ fan-out coverage":
      return {
        problem: "Article lacks an FAQ section or question-style headings.",
        suggestion: "Add an FAQ section with 2+ Q&A pairs, or rephrase headings as questions (What/How/Why…).",
      };
    default:
      return { problem: ev || "Check failed.", suggestion: "Review the article against this check." };
  }
}

interface QualityCardProps {
  geoScore?: GeoScore | null;
  brandVoiceStatus?: BrandVoiceStatus;
  onRescore?: () => Promise<void>;
  isRescoring?: boolean;
  onFixCheck?: (checkLabel: string) => Promise<void>;
}

export function QualityCard({
  geoScore,
  brandVoiceStatus,
  onRescore,
  isRescoring = false,
  onFixCheck,
}: QualityCardProps) {
  const [bvExpanded, setBvExpanded] = useState(false);
  const [diagnosed, setDiagnosed] = useState(false);
  const [fixingLabel, setFixingLabel] = useState<string | null>(null);

  const failingChecks = geoScore?.checks.filter((c) => !c.pass) ?? [];
  const canDiagnose = failingChecks.length > 0 && !!onFixCheck;

  const handleFix = async (label: string) => {
    if (!onFixCheck) return;
    setFixingLabel(label);
    try {
      await onFixCheck(label);
      // Re-run diagnosis after fix (score will update via parent state)
    } finally {
      setFixingLabel(null);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Quality checks
      </h3>

      {/* Brand Voice */}
      {brandVoiceStatus === undefined ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <span className="text-xs font-semibold text-slate-400">Brand Voice</span>
          <p className="mt-1 text-[11px] text-slate-400">Checked after the article is built.</p>
        </div>
      ) : brandVoiceStatus.status === "error" ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
          <span className="text-xs font-semibold text-amber-700">Brand Voice</span>
          <p className="mt-1 text-[11px] text-amber-600">
            Check failed — regenerate the article to retry.
          </p>
        </div>
      ) : brandVoiceStatus.status === "partial" ? (
        <div className="space-y-1.5 rounded-lg border border-orange-100 bg-orange-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-700">Brand Voice</span>
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
              Partially corrected
            </span>
          </div>
          <p className="text-[11px] text-orange-700">
            {brandVoiceStatus.residuals?.reduce((n, r) => n + r.violations.length, 0) ?? 0}{" "}
            violation(s) remain after 2 correction attempts.
          </p>
          <button
            type="button"
            onClick={() => setBvExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-orange-700 hover:text-orange-900"
          >
            {bvExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {bvExpanded ? "Hide details" : "Show details"}
          </button>
          {bvExpanded && brandVoiceStatus.residuals && (
            <ul className="mt-1 space-y-1">
              {brandVoiceStatus.residuals.map((r) =>
                r.violations.map((v, vi) => (
                  <li
                    key={`${r.paragraphIndex}-${vi}`}
                    className="text-[10px] leading-snug text-orange-800"
                  >
                    <span className="font-medium capitalize">{v.type.replace("_", " ")}</span>
                    {" — "}
                    <span className="rounded bg-orange-100 px-0.5 font-mono">{v.match}</span>{" "}
                    <span className="text-orange-600">(para {r.paragraphIndex})</span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <div>
            <span className="text-xs font-semibold text-emerald-700">Brand Voice</span>
            <p className="text-[11px] text-emerald-600">No violations detected.</p>
          </div>
        </div>
      )}

      {/* GEO Score */}
      {geoScore === undefined ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <span className="text-xs font-semibold text-slate-400">GEO Score</span>
          <p className="mt-1 text-[11px] text-slate-400">Generates after the article is built.</p>
        </div>
      ) : geoScore === null ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
          <span className="text-xs font-semibold text-amber-700">GEO Score</span>
          <p className="mt-1 text-[11px] text-amber-600">Score unavailable — an error occurred.</p>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">GEO Score</span>
            <span
              className={`text-sm font-bold ${
                geoScore.score >= 80
                  ? "text-emerald-600"
                  : geoScore.score >= 60
                  ? "text-amber-600"
                  : "text-red-500"
              }`}
            >
              {geoScore.score}/100
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200">
            <div
              className={`h-1.5 rounded-full transition-all ${
                geoScore.score >= 80
                  ? "bg-emerald-500"
                  : geoScore.score >= 60
                  ? "bg-amber-500"
                  : "bg-red-400"
              }`}
              style={{ width: `${geoScore.score}%` }}
            />
          </div>
          <div className="space-y-2">
            {geoScore.checks.map((c) => {
              const diag = diagnosed && !c.pass ? diagnoseCheck(c) : null;
              return (
                <div key={c.label}>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={c.pass ? "text-emerald-500" : "text-slate-300"}>
                      {c.pass ? "✓" : "○"}
                    </span>
                    <span className={c.pass ? "text-slate-600" : "text-slate-400"}>{c.label}</span>
                  </div>
                  {c.evidence && (
                    <p className="ml-4 mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-400">
                      {c.evidence}
                    </p>
                  )}

                  {/* Diagnosis panel — shown when diagnosed and check is failing */}
                  {diag && (
                    <div className="ml-4 mt-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-semibold text-amber-800 flex items-center gap-1">
                            <FileText className="h-2.5 w-2.5" />
                            Article issue
                          </p>
                          <p className="text-[10px] leading-snug text-amber-700">{diag.problem}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                        <p className="text-[10px] leading-snug text-slate-600">{diag.suggestion}</p>
                      </div>
                      {onFixCheck && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={fixingLabel !== null}
                          onClick={() => handleFix(c.label)}
                          className="h-6 w-full gap-1 text-[10px] px-2 bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          {fixingLabel === c.label ? (
                            <>
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              Fixing…
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-2.5 w-2.5" />
                              Auto-fix
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {geoScore.wordCount !== undefined && (
              <p className="mt-1 text-[10px] text-slate-400">
                {geoScore.wordCount.toLocaleString()} words
              </p>
            )}
          </div>
        </div>
      )}

      {/* Diagnose button — only when there are failing checks */}
      {canDiagnose && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDiagnosed((v) => !v)}
          className={`w-full gap-1.5 text-xs ${
            diagnosed
              ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-slate-200 text-slate-600"
          }`}
        >
          <Stethoscope className="h-3.5 w-3.5" />
          {diagnosed ? "Hide diagnosis" : "Diagnose failing checks"}
        </Button>
      )}

      {onRescore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isRescoring}
          onClick={onRescore}
          className="w-full gap-1.5 border-slate-200 text-slate-600"
        >
          {isRescoring ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Re-running…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Re-run checks
            </>
          )}
        </Button>
      )}
    </div>
  );
}

// ── Card 2: SEO Metadata ──────────────────────────────────────────────────────

interface MetadataCardProps {
  metadata: WordPressMetadata | null;
  onUpdate: (metadata: WordPressMetadata) => void;
  opportunityTitle?: string;
  isGenerating?: boolean;
  onGenerate: () => void;
  finalised?: boolean;
  onFinalise?: () => void;
}

const emptyMetadata = (title: string): WordPressMetadata => ({
  title,
  slug: "",
  excerpt: "",
  category: WP_CATEGORIES[0],
  tags: [],
  focus_keyword: "",
  seo_title: "",
  seo_description: "",
});

export function MetadataCard({
  metadata,
  onUpdate,
  opportunityTitle = "",
  isGenerating = false,
  onGenerate,
  finalised = false,
  onFinalise,
}: MetadataCardProps) {
  const [newTag, setNewTag] = useState("");
  const meta = metadata ?? emptyMetadata(opportunityTitle);

  const update = (upd: Partial<WordPressMetadata>) =>
    onUpdate({ ...(meta as WordPressMetadata), ...upd });

  const addTag = () => {
    const t = newTag.trim();
    const tags = meta.tags ?? [];
    if (!t || tags.includes(t)) return;
    update({ tags: [...tags, t] });
    setNewTag("");
  };

  const removeTag = (tag: string) =>
    update({ tags: (meta.tags ?? []).filter((x) => x !== tag) });

  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm transition-colors ${finalised ? "border-slate-200" : "border-slate-100"}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${finalised ? "text-slate-500" : "text-slate-300"}`}>
          SEO Metadata
        </h3>
        {finalised && metadata && !isGenerating && (
          <button
            type="button"
            onClick={onGenerate}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Refresh
          </button>
        )}
        {finalised && isGenerating && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating…
          </span>
        )}
      </div>

      {/* Locked state — article not yet finalised */}
      {!finalised ? (
        <div className="flex flex-col items-center gap-3 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-5 w-5 text-slate-300" />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-slate-500">Article not finalised</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
              Complete your edits, then finalise to unlock SEO metadata and publishing.
            </p>
          </div>
          <Button
            size="sm"
            onClick={onFinalise}
            className="gap-1.5 bg-slate-800 hover:bg-slate-900 text-white"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Finalise Article
          </Button>
        </div>
      ) : !metadata ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-center text-xs text-slate-500">
            Once you are happy with the article, generate SEO metadata from the title.
          </p>
          <Button onClick={onGenerate} disabled={isGenerating} size="sm" className="gap-2">
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate Metadata
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="wp-title" className="mb-1 block text-xs font-medium text-slate-600">
              Title
            </label>
            <Input
              id="wp-title"
              value={meta.title}
              onChange={(e) => update({ title: e.target.value })}
              className="w-full text-sm"
            />
          </div>
          <div>
            <label htmlFor="wp-slug" className="mb-1 block text-xs font-medium text-slate-600">
              Slug
            </label>
            <Input
              id="wp-slug"
              value={meta.slug}
              onChange={(e) => update({ slug: e.target.value })}
              className="w-full font-mono text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tags</label>
            <div className="flex flex-wrap gap-1">
              {(meta.tags ?? []).map((tag) => (
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
                  className="h-7 w-24 text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  Add
                </Button>
              </div>
            </div>
          </div>
          <div>
            <label
              htmlFor="wp-seo-title"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              SEO title (≤ 60 chars)
            </label>
            <Input
              id="wp-seo-title"
              value={meta.seo_title ?? ""}
              onChange={(e) => update({ seo_title: e.target.value })}
              placeholder="Title for search results"
              className="w-full text-sm"
              maxLength={60}
            />
            <p className="mt-0.5 text-[11px] text-slate-400">
              {(meta.seo_title ?? "").length}/60
            </p>
          </div>
          <div>
            <label
              htmlFor="wp-seo-description"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Meta description (≤ 160 chars)
            </label>
            <textarea
              id="wp-seo-description"
              value={meta.seo_description ?? ""}
              onChange={(e) => update({ seo_description: e.target.value })}
              rows={2}
              placeholder="Description for search results"
              className="w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              maxLength={160}
            />
            <p className="mt-0.5 text-[11px] text-slate-400">
              {(meta.seo_description ?? "").length}/160
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card 3: Publish ───────────────────────────────────────────────────────────

interface PublishCardProps {
  canSaveDraft: boolean;
  hasMetadata: boolean;
  onSaveDraft?: () => Promise<void>;
  isSaving?: boolean;
  sentAt?: string | null;
  onPublishLive?: () => Promise<void>;
  isPublishingLive?: boolean;
  publishedLiveAt?: string | null;
  locked?: boolean;
}

export function PublishCard({
  canSaveDraft,
  hasMetadata,
  onSaveDraft,
  isSaving = false,
  sentAt,
  onPublishLive,
  isPublishingLive = false,
  publishedLiveAt,
  locked = false,
}: PublishCardProps) {
  return (
    <div className={`space-y-2 rounded-lg border bg-white p-4 shadow-sm transition-colors ${locked ? "border-slate-100" : "border-slate-200"}`}>
      <h3 className={`mb-3 text-xs font-semibold uppercase tracking-wide ${locked ? "text-slate-300" : "text-slate-500"}`}>
        Publish
      </h3>

      {locked ? (
        /* Locked state */
        <div className="flex flex-col items-center gap-2 py-4">
          <Lock className="h-5 w-5 text-slate-200" />
          <p className="text-center text-[11px] leading-snug text-slate-300">
            Finalise the article to unlock publishing options.
          </p>
        </div>
      ) : (
        /* Unlocked state */
        <>
          {sentAt && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              <Check className="h-4 w-4 shrink-0" />
              Saved in Sanity as draft
            </div>
          )}
          <Button
            disabled={!canSaveDraft || isSaving}
            onClick={onSaveDraft}
            variant="outline"
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending to Sanity…
              </>
            ) : sentAt ? (
              "Update draft in Sanity"
            ) : (
              "Save as draft in Sanity"
            )}
          </Button>

          {publishedLiveAt && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              <Globe className="h-4 w-4 shrink-0" />
              Published live on aitomarketgroup.com
            </div>
          )}
          <Button
            disabled={!hasMetadata || isPublishingLive}
            onClick={onPublishLive}
            className="w-full"
          >
            {isPublishingLive ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Publish live on website
              </>
            )}
          </Button>
          {!hasMetadata && (
            <p className="text-center text-xs text-slate-400">
              Generate metadata first, then publish live.
            </p>
          )}
          {hasMetadata && !sentAt && (
            <p className="text-center text-xs text-slate-400">
              Save as draft first, then publish live.
            </p>
          )}
        </>
      )}
    </div>
  );
}

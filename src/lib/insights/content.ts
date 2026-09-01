/**
 * Insights content layer — backed by Supabase.
 * User-scoped: all read and write operations require userId.
 */

/* Re-export types & constants from the shared (client-safe) module */
export type {
  InsightCategory,
  InsightType,
  InsightProduct,
  InsightSolution,
  InsightIndustry,
  InsightFrontmatter,
  InsightDoc,
} from "./shared";
export { CATEGORY_LABELS } from "./shared";

import type {
  InsightCategory,
  InsightFrontmatter,
  InsightDoc,
  InsightCmsMetadata,
} from "./shared";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* ------------------------------------------------------------------ */
/*  Slug helper                                                        */
/* ------------------------------------------------------------------ */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/* ------------------------------------------------------------------ */
/*  DB row → InsightDoc mapping                                        */
/* ------------------------------------------------------------------ */

type DbRow = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  content: string;
  type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function rowToDoc(row: DbRow): InsightDoc {
  const meta = row.metadata ?? {};
  return {
    slug: row.slug,
    title: row.title,
    category: (meta.category as InsightCategory) ?? "blog",
    type: (meta.type as InsightDoc["type"]) ?? "Article",
    dateISO: (meta.dateISO as string) ?? row.created_at.slice(0, 10),
    readTimeMin: (meta.readTimeMin as number) ?? 3,
    excerpt: (meta.excerpt as string) ?? undefined,
    product: (meta.product as InsightDoc["product"]) ?? undefined,
    solution: (meta.solution as InsightDoc["solution"]) ?? undefined,
    industry: (meta.industry as InsightDoc["industry"]) ?? undefined,
    sourceUrl: (meta.sourceUrl as string) ?? undefined,
    heroImage: (meta.heroImage as string) ?? undefined,
    parentSlug: (meta.parentSlug as string) ?? undefined,
    cmsMetadata: (meta.cmsMetadata as InsightCmsMetadata) ?? undefined,
    markdown: row.content,
  };
}

/* ------------------------------------------------------------------ */
/*  Read helpers                                                       */
/* ------------------------------------------------------------------ */

export async function getAllInsights(userId: string): Promise<InsightFrontmatter[]> {
  const { data, error } = await supabaseAdmin
    .from("insights")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const dbDocs = (data as DbRow[]).map(rowToDoc);

  // Return frontmatter only (strip markdown)
  return dbDocs.map(({ markdown: _discard, ...fm }) => fm);
}

export async function getInsightBySlug(
  userId: string,
  slug: string
): Promise<InsightDoc | null> {
  // Check DB first
  const { data, error } = await supabaseAdmin
    .from("insights")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToDoc(data as DbRow) : null;
}

/* ------------------------------------------------------------------ */
/*  Write helpers                                                      */
/* ------------------------------------------------------------------ */

export async function createInsightFile(
  userId: string,
  data: {
    title: string;
    category: InsightCategory;
    markdown: string;
    parentSlug?: string;
    excerpt?: string;
    cmsMetadata?: InsightCmsMetadata;
  }
): Promise<string> {
  const { title, category, markdown, parentSlug, excerpt, cmsMetadata } = data;
  const base = slugify(title) || "article";
  const now = new Date().toISOString().slice(0, 10);

  // Ensure slug uniqueness within this user's articles
  let slug = base;
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const { data: existing } = await supabaseAdmin
      .from("insights")
      .select("slug")
      .eq("user_id", userId)
      .eq("slug", candidate)
      .maybeSingle();

    if (!existing) {
      slug = candidate;
      break;
    }
    attempt++;
  }

  const metadata = {
    category,
    type: "Article",
    dateISO: now,
    readTimeMin: 3,
    ...(excerpt ? { excerpt } : {}),
    ...(parentSlug ? { parentSlug } : {}),
    ...(cmsMetadata ? { cmsMetadata } : {}),
  };

  const { error } = await supabaseAdmin.from("insights").insert({
    user_id: userId,
    slug,
    title,
    content: markdown,
    type: category,
    metadata,
  });

  if (error) throw error;
  return slug;
}

export async function updateInsightCmsMetadata(
  userId: string,
  slug: string,
  cmsMetadata: InsightCmsMetadata
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("insights")
    .select("metadata")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return false;

  const updatedMeta = { ...(data.metadata ?? {}), cmsMetadata };

  const { error: updateError } = await supabaseAdmin
    .from("insights")
    .update({ metadata: updatedMeta, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("slug", slug);

  return !updateError;
}

export async function updateTitle(
  userId: string,
  slug: string,
  newTitle: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("insights")
    .update({ title: newTitle, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("slug", slug);

  return !error;
}

export async function saveInsightMarkdown(
  userId: string,
  slug: string,
  markdown: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("insights")
    .update({ content: markdown, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("slug", slug);

  return !error;
}

export async function updateHeroImage(
  userId: string,
  slug: string,
  heroImage: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("insights")
    .select("metadata")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return false;

  const updatedMeta = { ...(data.metadata ?? {}), heroImage };

  const { error: updateError } = await supabaseAdmin
    .from("insights")
    .update({ metadata: updatedMeta, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("slug", slug);

  return !updateError;
}

export async function deleteInsightBySlug(
  userId: string,
  slug: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("insights")
    .delete()
    .eq("user_id", userId)
    .eq("slug", slug);

  return !error;
}
